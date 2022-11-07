/**
 * External dependencies
 */
import {
	Box,
	FormControl,
	Input,
} from '@chakra-ui/react';
import rd3 from 'react-d3-library';

export default function SVG() {
	const RD3Component = rd3.Component;

	return (
		<Box>
			<FormControl>
				<Input placeholder="Workspace Name" />
			</FormControl>
			<FormControl>
				<Input placeholder="Epic Issue Number" />
			</FormControl>
			<RD3Component />
		</Box>
	);
}
