/**
 * External dependencies
 */
import { useEffect, useState } from 'react';
import {
	Box,
	FormControl,
	Input,
} from '@chakra-ui/react';
import rd3 from 'react-d3-library';

/**
 * Internal dependencies
 */
import { generateGraph } from '../../utils/d3';
import { getGraphData } from '../../data/graph-data';
import { isEmpty } from '../../utils/common';

export default function SVG() {
	const [ graphData, setGraphData ] = useState( null );

	useEffect( () => {
		getGraphData(
			'Execution',
			5237,
			'https://api.zenhub.com/public/graphql/',
			'zh_9e8cd9f1354f53832aeed5ceb3855992ecbc4d6df1943ea485826675b483f88b'
		).then( setGraphData );
	}, [] );

	const RD3Component = rd3.Component;

	return (
		<Box>
			<FormControl>
				<Input placeholder="Workspace Name" />
			</FormControl>
			<FormControl>
				<Input placeholder="Epic Issue Number" />
			</FormControl>
			{ ! isEmpty( graphData ) && <RD3Component data={ generateGraph( graphData ) } /> }
		</Box>
	);
}
