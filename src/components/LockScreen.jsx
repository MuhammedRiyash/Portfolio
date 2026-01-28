import React from 'react';
import { OWNERSHIP_CONFIG } from '../config';

const LockScreen = () => {
    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black text-white p-6">
            <div className="max-w-md w-full glass-morphism p-8 rounded-3xl border border-red-500/30 text-center animate-in fade-in zoom-in duration-500">
                <div className="mb-6 flex justify-center">
                    <div className="w-20 h-20 rounded-full bg-red-500/10 flex items-center justify-center border border-red-500/20">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m0 0v2m0-2h2m-2 0H10m11 3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                    </div>
                </div>
                <h1 className="text-3xl font-bold mb-4 text-red-500">Protection Violation</h1>
                <p className="text-gray-400 mb-6 leading-relaxed">
                    This portfolio project is the intellectual property of <strong>{OWNERSHIP_CONFIG.OWNER_NAME}</strong>.
                    The template has entered an error state due to a violation of ownership or attribution integrity.
                </p>
                <div className="p-4 bg-red-500/5 rounded-xl border border-red-500/10 mb-6">
                    <p className="text-sm text-red-400 font-mono">
                        Error: Ownership metadata tampered or missing.
                    </p>
                </div>
                <p className="text-xs text-gray-500">
                    Contact: <a href={`mailto:${OWNERSHIP_CONFIG.OWNER_EMAIL}`} className="underline hover:text-red-400 transition-colors">{OWNERSHIP_CONFIG.OWNER_EMAIL}</a>
                </p>
            </div>
            <style>{`
        .glass-morphism {
          background: rgba(15, 15, 15, 0.8);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
        }
      `}</style>
        </div>
    );
};

export default LockScreen;
