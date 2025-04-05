import { ReactNode, useEffect } from 'react';
import { MiniKit } from '@worldcoin/minikit-js';

export default function MiniKitProvider({ children }) {
  useEffect(() => {
    // You can add your app ID here if you have one
    MiniKit.install();
    
    // Check if MiniKit is installed properly
    console.log('MiniKit installed:', MiniKit.isInstalled());
  }, []);

  return <>{children}</>;
}