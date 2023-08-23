/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import * as moment from 'moment';
import { TimeInterval } from '../../../../common/TimeInterval';
import { ActionType } from './actions';
import { ComparePeriod, SortingOrder } from '../../utils/calculateCompare';
import { AreaUnitType } from '../../utils/getAreaUnitConversion';

export enum ChartTypes {
	line = 'line',
	bar = 'bar',
	compare = 'compare',
	map = 'map',
	threeD = '3D'
}

// Rates that can be graphed, only relevant to line graphs.
export const LineGraphRates = {
	'second': (1 / 3600),
	'minute': (1 / 60),
	'hour': 1,
	'day': 24
}

export enum ReadingsPerDay {
	twentyFour = 1,
	twelve = 2,
	eight = 3,
	six = 4,
	four = 6,
	three = 8,
	twelveHour = 12
}

export interface UpdateSelectedMetersAction {
	type: ActionType.UpdateSelectedMeters;
	meterIDs: number[];
}

export interface UpdateSelectedGroupsAction {
	type: ActionType.UpdateSelectedGroups;
	groupIDs: number[];
}

export interface UpdateSelectedUnitAction {
	type: ActionType.UpdateSelectedUnit;
	unitID: number;
}

export interface UpdateSelectedAreaUnitAction {
	type: ActionType.UpdateSelectedAreaUnit;
	areaUnit: AreaUnitType;
}

export interface UpdateBarDurationAction {
	type: ActionType.UpdateBarDuration;
	barDuration: moment.Duration;
}

export interface ChangeChartToRenderAction {
	type: ActionType.ChangeChartToRender;
	chartType: ChartTypes;
}

export interface ToggleAreaNormalizationAction {
	type: ActionType.ToggleAreaNormalization;
}

export interface ToggleShowMinMaxAction {
	type: ActionType.ToggleShowMinMax;
}

export interface ChangeBarStackingAction {
	type: ActionType.ChangeBarStacking;
}

export interface ChangeGraphZoomAction {
	type: ActionType.ChangeGraphZoom;
	timeInterval: TimeInterval;
}

export interface ChangeSliderRangeAction {
	type: ActionType.ChangeSliderRange;
	sliderInterval: TimeInterval;
}

export interface ResetRangeSliderStackAction {
	type: ActionType.ResetRangeSliderStack;
}

export interface UpdateComparePeriodAction {
	type: ActionType.UpdateComparePeriod;
	comparePeriod: ComparePeriod;
	currentTime: moment.Moment;
}

export interface ChangeCompareSortingOrderAction {
	type: ActionType.ChangeCompareSortingOrder;
	compareSortingOrder: SortingOrder;
}

export interface SetHotlinked {
	type: ActionType.SetHotlinked;
	hotlinked: boolean;
}

export interface ToggleOptionsVisibility {
	type: ActionType.ToggleOptionsVisibility;
}

export interface UpdateLineGraphRate {
	type: ActionType.UpdateLineGraphRate;
	lineGraphRate: LineGraphRate;
}

export interface ConfirmGraphRenderOnce {
	type: ActionType.ConfirmGraphRenderOnce;
}

export interface UpdateThreeDReadingsPerDay {
	type: ActionType.UpdateThreeDReadingsPerDay;
	readingsPerDay: ReadingsPerDay;
}
export interface UpdateThreeDMeterOrGroupInfo {
	type: ActionType.UpdateThreeDMeterOrGroupInfo;
	meterOrGroupID: MeterOrGroupID;
	meterOrGroup: MeterOrGroup;
}

export type GraphAction =
	| ChangeGraphZoomAction
	| ChangeSliderRangeAction
	| ResetRangeSliderStackAction
	| ChangeBarStackingAction
	| ToggleAreaNormalizationAction
	| ToggleShowMinMaxAction
	| ChangeChartToRenderAction
	| UpdateBarDurationAction
	| UpdateSelectedGroupsAction
	| UpdateSelectedMetersAction
	| UpdateSelectedUnitAction
	| UpdateSelectedAreaUnitAction
	| UpdateComparePeriodAction
	| SetHotlinked
	| ChangeCompareSortingOrderAction
	| ToggleOptionsVisibility
	| UpdateLineGraphRate
	| ConfirmGraphRenderOnce
	| UpdateThreeDReadingsPerDay
	| UpdateThreeDMeterOrGroupInfo;

export interface LineGraphRate {
	label: string,
	rate: number
}

export type MeterOrGroupID = number | null;
export enum MeterOrGroup { meters = 'meters', groups = 'groups' }
export enum ByMeterOrGroup { meters = 'byMeterID', groups = 'byGroupID' }

export interface ThreeDState {
	meterOrGroupID: MeterOrGroupID;
	meterOrGroup: MeterOrGroup;
	readingsPerDay: ReadingsPerDay;
}

export interface GraphState {
	areaNormalization: boolean;
	selectedMeters: number[];
	selectedGroups: number[];
	selectedUnit: number;
	selectedAreaUnit: AreaUnitType;
	timeInterval: TimeInterval;
	rangeSliderInterval: TimeInterval;
	barDuration: moment.Duration;
	comparePeriod: ComparePeriod;
	compareTimeInterval: TimeInterval;
	compareSortingOrder: SortingOrder;
	chartToRender: ChartTypes;
	barStacking: boolean;
	hotlinked: boolean;
	optionsVisibility: boolean;
	lineGraphRate: LineGraphRate;
	renderOnce: boolean;
	showMinMax: boolean;
	threeD: ThreeDState;
}
