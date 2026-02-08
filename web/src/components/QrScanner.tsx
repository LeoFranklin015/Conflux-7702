'use client';

import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { X, Camera } from 'lucide-react';

interface QrScannerProps {
  onScan: (result: string) => void;
  onClose: () => void;
}

export function QrScanner({ onScan, onClose }: QrScannerProps) {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const scanner = new Html5Qrcode('qr-reader');
    scannerRef.current = scanner;

    scanner
      .start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => {
          // Handle ethereum: URI or plain address
          let address = decodedText;
          if (address.startsWith('ethereum:')) {
            address = address.replace('ethereum:', '').split('@')[0].split('/')[0];
          }
          scanner.stop().catch(() => {});
          onScan(address);
        },
        () => {}
      )
      .catch((err) => {
        setError('Camera access denied or not available');
        console.error('QR scanner error:', err);
      });

    return () => {
      scanner.stop().catch(() => {});
    };
  }, [onScan]);

  return (
    <div className="fixed inset-0 bg-black/90 flex flex-col items-center justify-center z-[60]">
      <div className="w-full max-w-sm px-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Camera className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Scan QR Code</span>
          </div>
          <button
            onClick={onClose}
            className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-white/10 transition"
          >
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>

        <div
          id="qr-reader"
          className="w-full rounded-2xl overflow-hidden bg-black"
        />

        {error && (
          <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive text-center">
            {error}
          </div>
        )}

        <p className="text-xs text-muted-foreground text-center">
          Point your camera at a wallet address QR code
        </p>
      </div>
    </div>
  );
}
