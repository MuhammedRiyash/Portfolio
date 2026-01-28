import React, { useState, useEffect } from 'react';
import { OWNERSHIP_CONFIG } from '../config';
import LockScreen from '../components/LockScreen';

const VALID_NAME = "Muhammad Riyash";
const VALID_EMAIL = "thismd.riyash@gmail.com";

const validateIntegrity = () => {
    try {
        const isNameValid = OWNERSHIP_CONFIG.OWNER_NAME === VALID_NAME;
        const isEmailValid = OWNERSHIP_CONFIG.OWNER_EMAIL === VALID_EMAIL;

        // Additional stealth checks could be added here
        return isNameValid && isEmailValid;
    } catch (e) {
        return false;
    }
};

export const ProtectionLayer = ({ children }) => {
    const [isIntegrityMaintained, setIsIntegrityMaintained] = useState(true);

    useEffect(() => {
        const check = () => {
            const isValid = validateIntegrity();
            setIsIntegrityMaintained(isValid);

            if (!isValid) {
                console.error("Ownership integrity violation detected. Portfolio locked.");
                // Optional: Trigger alert/notification logic here
            }
        };

        check();
        // Re-check periodically to prevent runtime tampering
        const interval = setInterval(check, 5000);
        return () => clearInterval(interval);
    }, []);

    if (!isIntegrityMaintained) {
        return <LockScreen />;
    }

    return children;
};
