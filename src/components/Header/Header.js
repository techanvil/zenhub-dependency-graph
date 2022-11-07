/**
 * External dependencies
 */
import {
	Box,
	Button,
	Container,
	Flex,
	HStack,
	Spacer,
	useColorModeValue,
	useDisclosure,
} from '@chakra-ui/react';

/**
 * Internal dependencies
 */
import APIKeyModal from '../APIKeyModal/APIKeyModal';

export default function Header() {
	const { isOpen, onOpen, onClose } = useDisclosure();

	return (
		<>
			<Box as="section" pb={ { base: '12', md: '24' } }>
				<Box as="nav" bg="bg-surface" boxShadow={ useColorModeValue( 'sm', 'sm-dark' ) }>
					<Container py={ { base: '4', lg: '5' } } maxW="100%">
						<HStack spacing="10" justify="space-between">
							<Flex justify="space-between" flex="1">
								<Spacer />
								<HStack spacing="3">
									<Button
										colorScheme="blue"
										mr={ 3 }
										onClick={ onOpen }
									>API Key</Button>
								</HStack>
							</Flex>
						</HStack>
					</Container>
				</Box>
			</Box>
			<APIKeyModal isOpen={ isOpen } onClose={ onClose } />
		</>
	)
}