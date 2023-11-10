/* This Source Code Form is subject to the terms of the Mozilla Public
* License, v. 2.0. If a copy of the MPL was not distributed with this
* file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import * as React from 'react';
import { Modal, ModalHeader, ModalBody } from 'reactstrap';
import AdvOptionsComponent from './/AdvOptionsComponent';
import HeaderButtonsComponent from './HeaderButtonsComponent';
import { FormattedMessage } from 'react-intl';
import ReactTooltip from 'react-tooltip';
import { useState } from 'react';
import getPage from '../utils/getPage';

/**
 * React component to define the collapsed Advanced Options modal
 * @returns Modal element
 */
export default function AdvancedOptionsModal() {
	const [showModal, setShowModal] = useState(true);
	const toggleModal = () => { setShowModal(!showModal); }
	const inlineStyle: React.CSSProperties = {
		display: 'inline',
		paddingLeft: '5px'
	};
	const labelStyle: React.CSSProperties = {
		fontWeight: 'bold',
		margin: 0
	};

	return (
		<div style={inlineStyle}>
			<Modal isOpen={showModal} toggle={toggleModal} onOpened={ReactTooltip.rebuild} onClick={() => ReactTooltip.hide()}>
				<ModalHeader>
					<FormattedMessage id='advOptions' />
				</ModalHeader>
				<ModalBody>
					<div style={labelStyle}><FormattedMessage id='navigation' /></div>
					<HeaderButtonsComponent />
					{/* Only render graph options if on the graph page */}
					{getPage() === '' &&
						<AdvOptionsComponent />
					}
				</ModalBody>
			</Modal>
		</div>
	)
}