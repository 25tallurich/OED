/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const database = require('./database');
const { mapToObject } = require('../util');
const determineMaxPoints = require('../util/determineMaxPoints');
const moment = require('moment');
const _ = require('lodash');
const log = require('../log');

const sqlFile = database.sqlFile;

class Reading {
	/**
	 * Creates a new reading
	 * @param meterID
	 * @param reading
	 * @param {Moment} startTimestamp
	 * @param {Moment} endTimestamp
	 */
	constructor(meterID, reading, startTimestamp, endTimestamp) {
		this.meterID = meterID;
		this.reading = reading;
		this.startTimestamp = startTimestamp;
		this.endTimestamp = endTimestamp;
	}

	/**
	 * Returns a promise to create the readings table.
	 * @param conn the database connection to use
	 * @returns {Promise.<>}
	 */
	static createTable(conn) {
		return conn.none(sqlFile('reading/create_readings_table.sql'));
	}

	/**
	 * Returns a promise to create the function and materialized views that aggregate
	 * readings by various time intervals.
	 * @param conn the database connection to use
	 * @returns {Promise<void>}
	 */
	static createReadingsMaterializedViews(conn) {
		return conn.none(sqlFile('reading/create_reading_views.sql'));
	}

	/**
	 * Returns a promise to create the compare function
	 * @param conn the database connection to use
	 */
	static createCompareReadingsFunction(conn) {
		return conn.none(sqlFile('reading/create_function_get_compare_readings.sql'));
	}

	/**
	 * Returns a promise to create the reading_line_accuracy type.
	 * This needs to be run before Reading.createTable().
	 * @param conn the connection to use
	 * @return {Promise<void>}
	 */
	static createReadingLineAccuracyEnum(conn) {
		return conn.none(sqlFile('reading/create_reading_line_accuracy_enum.sql'));
	}

	/**
	 * Returns a promise to create the 3D readings function
	 * @param conn the database connection to use
	 */
	static create3dReadingsFunction(conn) {
		return conn.none(sqlFile('reading/create_function_get_3d_readings.sql'));
	}

	/**
	 * Refreshes the daily readings view.
	 * Should be called at least once a day, preferably in the middle of the night.
	 * @param conn The connection to use
	 * @returns {Promise<void>}
	 */
	static refreshDailyReadings(conn) {
		// This can't be a function because you can't call REFRESH inside a function
		return conn.none('REFRESH MATERIALIZED VIEW daily_readings_unit');
	}

	/**
	 * Refreshes the hourly readings view.
	 * Should be called at least once a day but need to do hourly if the site wants zooming in
	 * to see hourly data as it is available. This function can take more time than refreshing
	 * the daily readings so be sure calling it more frequently does not impact the
	 * server response time. If only called once a day, then probably best to do so in the middle
	 * of the night as suggested for daily refresh.
	 * @param conn The connection to use
	 * @returns {Promise<void>}
	 */
	static refreshHourlyReadings(conn) {
		// This can't be a function because you can't call REFRESH inside a function
		// TODO This will be removed once we completely transition to the unit version.
		return conn.none('REFRESH MATERIALIZED VIEW hourly_readings_unit');
	}

	/**
	 * Because moment allows modification of its values, this creates a new Reading where all the timestamps
	 * are cloned so they cannot change unless you modify this new one.
	 * 
	 * @returns a duplicate of the reading where the moment timestamps are cloned so cannot change.
	 */
	clone() {
		return new Reading(this.meterID, this.reading, this.startTimestamp.clone(), this.endTimestamp.clone());
	}

	/**
	 * Change a row from the readings table into a Reading object.
	 * @param row The row from the table to be changed.
	 * @returns Reading object from row
	 */
	static mapRow(row) {
		return new Reading(row.meter_id, row.reading, row.start_timestamp, row.end_timestamp);
	}

	/**
	 * Returns the number of readings which exist in the database, total.
	 * @param conn the connection to use
	 * @returns {number} the number of readings in the entire readings table
	 */
	static async count(conn) {
		const { count } = await conn.one('SELECT COUNT(*) as count FROM readings');
		return parseInt(count);
	}

	/**
	 * Returns a promise to insert all of the given readings into the database (as a transaction)
	 * @param {array<Reading>} readings the readings to insert
	 * @param conn is the connection to use.
	 * @returns {Promise.<>}
	 */
	static insertAll(readings, conn) {
		return conn.tx(t => t.sequence(function seq(i) {
			const seqT = this;
			return readings[i] && readings[i].insert(seqT);
		}));
	}

	/**
	 * Returns a promise to insert or update all of the given readings into the database (as a transaction)
	 * @param {array<Reading>} readings the readings to insert or update
	 * @param conn is the connection to use.
	 * @returns {Promise.<>}
	 */
	static insertOrUpdateAll(readings, conn) {
		return conn.tx(t => t.sequence(function seq(i) {
			const seqT = this;
			return readings[i] && readings[i].insertOrUpdate(seqT);
		}));
	}

	/**
	 * Returns a promise to insert or ignore all of the given readings into the database (as a transaction)
	 * @param {array<Reading>} readings the readings to insert or update
	 * @param conn is the connection to use.
	 * @returns {Promise<any>}
	 */
	static insertOrIgnoreAll(readings, conn) {
		return conn.tx(t => t.sequence(function seq(i) {
			const seqT = this;
			return readings[i] && readings[i].insertOrIgnore(seqT);
		}));
	}

	/**
	 * Returns the count(number of rows) for a meter
	 * @param meterID 
	 * @param conn 
	 */
	static async getCountByMeterIDAndDateRange(meterID, startDate, endDate, conn) {
		const row = await conn.any(sqlFile('reading/get_count_by_meter_id_and_date_range.sql'), {
			meterID: meterID,
			startDate: startDate,
			endDate: endDate
		});
		return parseInt(row[0].count);
	}

	/**
	 * Returns a promise to get all of the readings for this meter from the database.
	 * @param meterID The id of the meter to find readings for
	 * @param conn is the connection to use.
	 * @returns {Promise.<array.<Reading>>}
	 */
	static async getAllByMeterID(meterID, conn) {
		const rows = await conn.any(sqlFile('reading/get_all_readings_by_meter_id.sql'), { meterID: meterID });
		return rows.map(Reading.mapRow);
	}

	/**
	 * Returns a promise to get all of the readings (so raw) for this meter within (inclusive) a specified date range from the
	 * database. If no startDate is specified, all readings from the beginning of time to the endDate are returned.
	 * If no endDate is specified, all readings after and including the startDate are returned.
	 * @param meterID
	 * @param {Date} startDate
	 * @param {Date} endDate
	 * @param conn is the connection to use.
	 * @returns {Promise.<array.<Reading>>}
	 */
	static async getReadingsByMeterIDAndDateRange(meterID, startDate, endDate, conn) {
		const rows = await conn.any(sqlFile('reading/get_readings_by_meter_id_and_date_range.sql'), {
			meterID: meterID,
			startDate: startDate,
			endDate: endDate
		});
		// This does not do the usual row mapping because the identifiers are not the usual ones and there
		// is no meter id. All this is to make the data smaller.
		return rows;
	}

	/**
	 * Returns a promise to insert this reading into the database.
	 * @param conn is the connection to use.
	 * @returns {Promise.<>}
	 */
	insert(conn) {
		return conn.none(sqlFile('reading/insert_new_reading.sql'), this);
	}

	/**
	 * Returns a promise to insert this reading into the database, or update it if it already exists.
	 * @param conn is the connection to use.
	 * @returns {Promise.<>}
	 */
	insertOrUpdate(conn) {
		return conn.none(sqlFile('reading/insert_or_update_reading.sql'), this);
	}

	/**
	 * Returns a promise to insert this reading into the database, or ignore it if it already exists.
	 * @param conn is the connection to use.
	 * @returns {Promise.<>}
	 */
	insertOrIgnore(conn) {
		return conn.none(sqlFile('reading/insert_or_ignore_reading.sql'), this);
	}

	/**
	 * Gets line readings for meters for the given time range
	 * @param meterIDs The meter IDs to get readings for
	 * @param graphicUnitId The unit id that the reading should be returned in, i.e., the graphic unit
	 * @param fromTimestamp An optional start point for the time range of readings returned
	 * @param toTimestamp An optional end point for the time range of readings returned
	 * @param conn the connection to use.
	 * @returns {Promise<object<int, array<{reading_rate: number, start_timestamp: }>>>}
	 */
	static async getMeterLineReadings(meterIDs, graphicUnitId, fromTimestamp = null, toTimestamp = null, conn) {
		const [maxRawPoints, maxHourlyPoints] = determineMaxPoints();
		/**
		 * @type {array<{meter_id: int, reading_rate: Number, start_timestamp: Moment, end_timestamp: Moment}>}
		 */
		const allMeterLineReadings = await conn.func('meter_line_readings_unit',
			[meterIDs, graphicUnitId, fromTimestamp || '-infinity', toTimestamp || 'infinity', 'auto', maxRawPoints, maxHourlyPoints]
		);

		const readingsByMeterID = mapToObject(meterIDs, () => []);
		for (const row of allMeterLineReadings) {
			readingsByMeterID[row.meter_id].push(
				{ reading_rate: row.reading_rate, start_timestamp: row.start_timestamp, end_timestamp: row.end_timestamp }
			);
		}
		return readingsByMeterID;
	}

	/**
	 * Gets line readings for groups for the given time range
	 * @param groupIDs The group IDs to get readings for
	 * @param graphicUnitId The unit id that the reading should be returned in, i.e., the graphic unit
	 * @param fromTimestamp An optional start point for the time range of readings returned
	 * @param toTimestamp An optional end point for the time range of readings returned
	 * @param conn the connection to use.
	 * @returns {Promise<object<int, array<{reading_rate: number, start_timestamp: }>>>}
	 */
	static async getGroupLineReadings(groupIDs, graphicUnitId, fromTimestamp, toTimestamp, conn) {
		// maxRawPoints is not used for groups.
		const [maxRawPoints, maxHourlyPoints] = determineMaxPoints();
		/**
		 * @type {array<{group_id: int, reading_rate: Number, start_timestamp: Moment, end_timestamp: Moment}>}
		 */
		const allGroupLineReadings = await conn.func('group_line_readings_unit',
			[groupIDs, graphicUnitId, fromTimestamp, toTimestamp, 'auto', maxHourlyPoints]
		);

		const readingsByGroupID = mapToObject(groupIDs, () => []);
		for (const row of allGroupLineReadings) {
			readingsByGroupID[row.group_id].push(
				{ reading_rate: row.reading_rate, start_timestamp: row.start_timestamp, end_timestamp: row.end_timestamp }
			);
		}
		return readingsByGroupID;

	}

	/**
	 * Gets barchart readings for the given time range for the given meters
	 * @param meterIDs The meters to get barchart readings for
	 * @param graphicUnitId The unit id that the reading should be returned in, i.e., the graphic unit
	 * @param fromTimestamp The start of the barchart interval
	 * @param toTimestamp the end of the barchart interval
	 * @param barWidthDays the width of each bar in days
	 * @param conn the connection to use.
	 * @returns {Promise<object<int, array<{reading: number, start_timestamp: Moment, end_timestamp: Moment}>>>}
	 */
	static async getMeterBarReadings(meterIDs, graphicUnitId, fromTimestamp, toTimestamp, barWidthDays, conn) {
		const allBarReadings = await conn.func('meter_bar_readings_unit', [meterIDs, graphicUnitId, barWidthDays, fromTimestamp, toTimestamp]);
		const barReadingsByMeterID = mapToObject(meterIDs, () => []);
		for (const row of allBarReadings) {
			barReadingsByMeterID[row.meter_id].push(
				{ reading: row.reading, start_timestamp: row.start_timestamp, end_timestamp: row.end_timestamp }
			);
		}
		return barReadingsByMeterID;
	}

	/**
	 * Gets barchart readings for the given time range for the given groups
	 * @param groupIDs The groups to get barchart readings for
	 * @param graphicUnitId The unit id that the reading should be returned in, i.e., the graphic unit
	 * @param fromTimestamp The start of the barchart interval
	 * @param toTimestamp the end of the barchart interval
	 * @param barWidthDays the width of each bar in days
	 * @param conn the connection to use.
	 * @returns {Promise<object<int, array<{reading: number, start_timestamp: Moment, end_timestamp: Moment}>>>}
	 */
	static async getGroupBarReadings(groupIDs, graphicUnitId, fromTimestamp, toTimestamp, barWidthDays, conn) {
		const allBarReadings = await conn.func('group_bar_readings_unit', [groupIDs, graphicUnitId, barWidthDays, fromTimestamp, toTimestamp]);
		const barReadingsByGroupID = mapToObject(groupIDs, () => []);
		for (const row of allBarReadings) {
			barReadingsByGroupID[row.group_id].push(
				{ reading: row.reading, start_timestamp: row.start_timestamp, end_timestamp: row.end_timestamp }
			);
		}
		return barReadingsByGroupID;
	}

	/**
	 * Gets compare chart readings for the given time range and shift for the given meters
	 * @param meterIDs The meters to get compare chart readings for
	 * @param graphicUnitId The unit id that the reading should be returned in, i.e., the graphic unit
	 * @param {Moment} currStartTimestamp start of current/this compare period
	 * @param {Moment} currEndTimestamp end of current/this compare period
	 * @param {Duration} compareShift how far to shift back in time from current period to previous period
	 * @param conn the connection to use.
	 * @returns {Promise<void>}
	 */
	static async getMeterCompareReadings(meterIDs, graphicUnitId, currStartTimestamp, currEndTimestamp, compareShift, conn) {
		const allCompareReadings = await conn.func(
			'meter_compare_readings_unit',
			[meterIDs, graphicUnitId, currStartTimestamp, currEndTimestamp, compareShift.toISOString()]);
		const compareReadingsByMeterID = {};
		for (const row of allCompareReadings) {
			compareReadingsByMeterID[row.meter_id] = {
				curr_use: row.curr_use,
				prev_use: row.prev_use
			};
		}
		return compareReadingsByMeterID;
	}

	/**
	 * Gets compare chart readings for the given time range and shift for the given groups
	 * @param groupIDs The groups to get compare chart readings for
	 * @param graphicUnitId The unit id that the reading should be returned in, i.e., the graphic unit
	 * @param {Moment} currStartTimestamp start of current/this compare period
	 * @param {Moment} currEndTimestamp end of current/this compare period
	 * @param {Duration} compareShift how far to shift back in time from current period to previous period
	 * @param conn the connection to use.
	 * @returns {Promise<void>}
	 */
	static async getGroupCompareReadings(groupIDs, graphicUnitId, currStartTimestamp, currEndTimestamp, compareShift, conn) {
		const allCompareReadings = await conn.func(
			'group_compare_readings_unit',
			[groupIDs, graphicUnitId, currStartTimestamp, currEndTimestamp, compareShift.toISOString()]);
		const compareReadingsByGroupID = {};
		for (const row of allCompareReadings) {
			compareReadingsByGroupID[row.group_id] = {
				curr_use: row.curr_use,
				prev_use: row.prev_use
			};
		}
		return compareReadingsByGroupID;
	}

	/**
	 * Gets hourly line readings for a meter for the given time range
	 * @param meterIDs The meter IDs to get readings for
	 * @param graphicUnitId The unit id that the reading should be returned in, i.e., the graphic unit
	 * @param fromTimestamp An optional start point for the time range of readings returned
	 * @param toTimestamp An optional end point for the time range of readings returned
	 * @param sequenceNumber rate of hours per reading
	 * @param conn the connection to use.
	 * @return {Promise<object<int, array<{reading_rate: number, start_timestamp: }>>>}
	 */
	static async getThreeDReadings(meterIDs, graphicUnitId, fromTimestamp = null, toTimestamp = null, sequenceNumber, conn) {
		/**
		 * @type {array<{meter_id: int, reading_rate: Number, start_timestamp: Moment, end_timestamp: Moment}>}
		*/
		const allMeterThreeDReadings = await conn.func('meter_3d_readings_unit',
			[meterIDs, graphicUnitId, fromTimestamp || '-infinity', toTimestamp || 'infinity', sequenceNumber]
		);
		// Initialize empty plotly data 
		const xData = [];
		const yData = [];
		const zData = [];

		const numOfReadings = allMeterThreeDReadings.length;
		// If readings exist, find/replace missing readings if any, and format for plotly.
		// Otherwise, return empty z,y,z data
		if (numOfReadings > 0) {
			// Assume no missing readings, replace if needed.
			let readingsToReturn = allMeterThreeDReadings;

			// get the number of days days between start and end timestamps * readings per day.
			const readingsPerDay = 24 / sequenceNumber;
			const expectedNumOfReadings = toTimestamp && fromTimestamp ? toTimestamp.diff(fromTimestamp, 'days') * readingsPerDay : -1;
			// Run Fill holes algorithm if expected num of readings to not match received reading count.
			if (allMeterThreeDReadings.length !== expectedNumOfReadings) {
				const missingReadings = [];

				allMeterThreeDReadings.forEach((reading, index, arr) => {
					// The two values to compare, Current and next readings.
					const currentReading = reading;
					const nextReading = arr[index + 1];
					// If a next exists, and current / next timestamps don't overlap, fill the gap with null readings.
					if (nextReading && currentReading.end_timestamp.valueOf() !== nextReading.start_timestamp.valueOf()) {

						// our null iteration target timestamp (push null until target reached.)
						const targetStartTimestamp = nextReading.start_timestamp;

						// set next timestamp to overlap with current endTS 
						let nextStartTimeStamp = currentReading.end_timestamp.clone();
						// gap to fill.
						let nextEndTimeStamp = nextStartTimeStamp.clone().add(sequenceNumber, 'hour');

						// Push missing null readings until the readings overlap
						// do-while; a reading is missing, therefore must be executed at least once.
						do {
							missingReadings.push({
								reading_rate: null,
								start_timestamp: nextStartTimeStamp,
								end_timestamp: nextEndTimeStamp
							})

							// To make the readings overlap, next start time is current end time
							nextStartTimeStamp = nextEndTimeStamp.clone();
							nextEndTimeStamp = nextStartTimeStamp.clone().add(sequenceNumber, 'hour');

							// if nextStartTS and targetStartTS overlap, all gaps have been filled; break
						} while (nextStartTimeStamp.valueOf() !== targetStartTimestamp.valueOf());
					}
				});

				// Merge the Original Readings with 'hole' readings.
				let merged = [];
				// While both arrays have values compare and push since both arrays are individually sorted, you can compare the first indexes of each
				while (allMeterThreeDReadings.length && missingReadings.length) {
					// array.shift() works similarly to dequeue() in that it pops off the front of the array
					if (allMeterThreeDReadings[0].start_timestamp.valueOf() < missingReadings[0].start_timestamp.valueOf()) {
						merged.push(allMeterThreeDReadings.shift());
					} else {
						merged.push(missingReadings.shift());
					}
				}
				// Push remaining values, if any
				while (allMeterThreeDReadings.length) {
					merged.push(allMeterThreeDReadings.shift());
				}
				// Push remaining values, if any
				while (missingReadings.length) {
					merged.push(missingReadings.shift());
				}

				// Update the values to be formatted and returned.
				readingsToReturn = merged;
			}

			// Format readings.
			// Create 2D array by chunking, each 'chunk' corresponds to a day's worth of readings.
			const chunkedReadings = _.chunk(readingsToReturn, 24 / sequenceNumber);
			// This variable corresponds to the first day's readings, to get the hourly timestamps for xData.
			const chunkedReadingsHour = _.cloneDeep(chunkedReadings[0]);

			// get the hourly timestamp intervals from
			chunkedReadingsHour.forEach(hour => xData.push(hour.start_timestamp.add(hour.end_timestamp.diff(hour.start_timestamp) / 2).valueOf()));
			chunkedReadings.forEach(day => {
				let dayReadings = [];
				yData.push(day[0].start_timestamp.valueOf());

				day.forEach(hour => dayReadings.push(hour.reading_rate));
				zData.push(dayReadings);
			});
		}

		const threeDData = {
			xData: xData,
			yData: yData,
			zData: zData
		}
		return threeDData;
	}

	/**
	 * Gets hourly readings for groups for the given time range
	 * @param groupIDs The group IDs to get readings for
	 * @param graphicUnitId The unit id that the reading should be returned in, i.e., the graphic unit
	 * @param fromTimestamp An optional start point for the time range of readings returned
	 * @param toTimestamp An optional end point for the time range of readings returned
	 * @param sequenceNumber rate of hours per reading
	 * @param conn the connection to use.
	 * @returns {Promise<object<int, array<{reading_rate: number, start_timestamp: }>>>}
	 */
	static async getGroupThreeDReadings(groupIDs, graphicUnitId, fromTimestamp, toTimestamp, sequenceNumber, conn) {
		/**
		 * @type {array<{group_id: int, reading_rate: Number, start_timestamp: Moment, end_timestamp: Moment}>}
		 */
		//console.log('test');

		const allGroupThreeDReadings = await conn.func('group_3d_readings_unit',
			[groupIDs, graphicUnitId, fromTimestamp, toTimestamp, sequenceNumber]
		);

		//console.log('test', allGroupThreeDReadings);

		//TODO I used the same algorithm that Chris updated in getThreeDReadings so we need to confirm that i will work for
		// this function. 

		const xData = [];
		const yData = [];
		const zData = [];

		const numOfReadings = allGroupThreeDReadings.length;
		// If no readings, do nothing and return empty arrays
		if (numOfReadings > 0) {
			const readingsPerDay = 24 / sequenceNumber;
			// get the number of days days between start and end timestamps * readings per day.
			const expectedNumOfReadings = toTimestamp && fromTimestamp ? toTimestamp.diff(fromTimestamp, 'days') * readingsPerDay : -1;

			let readingsToReturn = allGroupThreeDReadings;
			// Run Fill holes algorithm if expected num of readings to not match received reading count.
			if (allGroupThreeDReadings.length !== expectedNumOfReadings) {

				let missingReadings = [];
				allGroupThreeDReadings.forEach((reading, index, arr) => {
					// If the next index is defined, and current / next timestamps don't overlap fill the gap.
					if (arr[index + 1] && arr[index].end_timestamp.valueOf() !== arr[index + 1].start_timestamp.valueOf()) {
						const currEndTimestamp = arr[index].end_timestamp;
						const targetStartTimestamp = arr[index + 1].start_timestamp;
						let nextStartTimeStamp = currEndTimestamp.clone();
						let nextEndTimeStamp = nextStartTimeStamp.clone().add(sequenceNumber, 'hour');
						//Push missing null readings until the readings overlap
						do {
							missingReadings.push({
								reading_rate: null,
								start_timestamp: nextStartTimeStamp,
								end_timestamp: nextEndTimeStamp
							})

							nextStartTimeStamp = nextEndTimeStamp.clone();
							nextEndTimeStamp = nextStartTimeStamp.clone().add(sequenceNumber, 'hour');
						} while (nextStartTimeStamp.valueOf() !== targetStartTimestamp.valueOf());
					}
				});

				let merged = [];
				// Merge the Original Readings with 'hole' readings.
				// While both arrays have values compare and push
				while (allGroupThreeDReadings.length && missingReadings.length) {
					if (allGroupThreeDReadings[0].start_timestamp.valueOf() < missingReadings[0].start_timestamp.valueOf()) {
						merged.push(allGroupThreeDReadings.shift());
					} else {
						merged.push(missingReadings.shift());
					}
				}
				// Push remaining values, if any
				while (allGroupThreeDReadings.length) {
					merged.push(allGroupThreeDReadings.shift());
				}
				// Push remaining values, if any
				while (missingReadings.length) {
					merged.push(missingReadings.shift());
				}
				readingsToReturn = merged;
			}
			// Format readings.
			const chunkedReadings = _.chunk(readingsToReturn, 24 / sequenceNumber);
			chunkedReadings[0].forEach(hour => xData.push(hour.start_timestamp.valueOf()));
			chunkedReadings.forEach(day => {
				let dayReadings = [];
				// Data data may need to be converted into 'moment' to save on network load
				yData.push(day[0].start_timestamp.valueOf());

				day.forEach(hour => dayReadings.push(hour.reading_rate));
				zData.push(dayReadings);
			});
		}

		const groupThreeDData = {
			xData: xData,
			yData: yData,
			zData: zData
		}

		//console.log(groupThreeDData);

		return groupThreeDData;

	}

	toString() {
		return `Reading [id: ${this.meterID}, reading: ${this.reading}, startTimestamp: ${this.startTimestamp}, endTimestamp: ${this.endTimestamp}]`;
	}
}

module.exports = Reading;
