// Modal.tsx

import React from 'react';

interface ModalProps {onClose: () => void;// Other props...
}

const Modal: React.FC<ModalProps> = ({ onClose }) => {return (<div className="modal">{/* Modal content */} <button onClick={onClose}>Close</button>
</div>
);
};

export default Modal;
