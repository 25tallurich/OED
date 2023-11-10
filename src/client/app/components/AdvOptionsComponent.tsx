/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
import * as React from 'react';
import {useSelector } from 'react-redux';
import { State } from '../types/redux/state';
// import { UnitRepresentType } from '../types/redux/units';
import ExportComponent from '../components/ExportComponent';
import ChartLinkContainer from '../containers/ChartLinkContainer';
import { ChartTypes } from '../types/redux/graph';
//import 'rc-slider/assets/index.css';
import GraphicRateMenuComponent from './GraphicRateMenuComponent';

/**
 * React Component that creates the Advanced Options Visablility
 * @returns Advanced Options element
 */
export default function AdvOptionsComponent() {
	//const dispatch = useDispatch();
	const divTopPadding: React.CSSProperties = {
		paddingTop: '15px'
	};
	// const handleToggleAdvOptionsVisibility = () => {
	// 	dispatch(toggleOptionsAdvVisibility());
	// }
	const graphState = useSelector((state: State) => state.graph);
	//chartToRender: ChartTypes;
	//optionsAdvVisibility: boolean;
	// const labelStyle: React.CSSProperties = {
	// 	fontWeight: 'bold',
	// 	margin: 0
	// };


	return graphState.optionsAdvVisibility && (
		<div>
			<GraphicRateMenuComponent />
			{graphState.chartToRender !== ChartTypes.compare && graphState.chartToRender !== ChartTypes.map &&
				<div style={divTopPadding}>
					<ExportComponent />
				</div>
			}
			<div style={divTopPadding}>
				<ChartLinkContainer />
			</div>
		</div>
	);
}