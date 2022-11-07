/**
 * External dependencies
 */
import {
	Box,
	Button,
	Container,
	Flex,
	Heading,
	HStack,
	useColorModeValue,
} from '@chakra-ui/react';



export default function Header( { onAPIKeyModalOpen = () => {} } ) {
	return (
		<>
			<Box as="section" pb={ { base: '12', md: '24' } }>
				<Box as="nav" bg="bg-surface" boxShadow={ useColorModeValue( 'sm', 'sm-dark' ) }>
					<Container py={ { base: '4', lg: '5' } } maxW="100%">
						<HStack spacing="10" justify="space-between">
							<Flex justify="space-between" flex="1">
								<HStack>
									<Heading as="h4" size="md">Zenhub Dependency Graph</Heading>
								</HStack>
								<HStack spacing="3">
									<Button
										colorScheme="blue"
										mr={ 3 }
										onClick={ onAPIKeyModalOpen }
									>API Key</Button>
								</HStack>
							</Flex>
						</HStack>
					</Container>
				</Box>
			</Box>
		</>
	)
}