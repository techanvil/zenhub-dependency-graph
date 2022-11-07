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
import { useLocalStorage } from '../../hooks/useLocalStorage';

export default function SVG() {
	const [ APIKey ] = useLocalStorage( 'zenhubAPIKey' );
	const [ graphData, setGraphData ] = useState( null );
	const [ workspace, setWorkspace ] = useState( null );
	const [ epic, setEpic ] = useState( null );

	useEffect( () => {
		if (
			isEmpty( APIKey ) ||
			isEmpty( workspace ) ||
			isEmpty( epic )
		) {
			return;
		}

		getGraphData(
			workspace,
			epic,
			'https://api.zenhub.com/public/graphql/',
			APIKey,
		).then( setGraphData );
	}, [ APIKey, epic, workspace ] );

	const RD3Component = rd3.Component;

	return (
		<Box>
			<FormControl>
				<Input placeholder="Workspace Name" onChange={ ( e ) => setWorkspace( e.target.value ) } />
			</FormControl>
			<FormControl>
				<Input placeholder="Epic Issue Number" onChange={ ( e ) => setEpic( parseInt( e.target.value ) ) } />
			</FormControl>
			{ ! isEmpty( graphData ) && <RD3Component data={ generateGraph( graphData ) } /> }
		</Box>
	);
}
