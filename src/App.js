/**
 * External dependencies
 */
import { useDisclosure } from '@chakra-ui/react';

/**
 * Internal dependencies
 */
import Header from './components/Header/Header';
import APIKeyModal from './components/APIKeyModal/APIKeyModal';
import './App.css';
import SVG from './components/SVG/SVG';

function App() {
	const { isOpen, onOpen, onClose } = useDisclosure();

  return (
    <div className="App">
      <Header onAPIKeyModalOpen={ onOpen } />
      <SVG />
      <APIKeyModal isOpen={ isOpen } onClose={ onClose } />
    </div>
  );
}

export default App;
