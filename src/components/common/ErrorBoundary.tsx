'use client';

import * as React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  children: React.ReactNode;
  /** Ditampilkan di judul, mis. "Halaman Pengguna". */
  label?: string;
}

interface State {
  error: Error | null;
}

/**
 * Menangkap galat render agar satu komponen rusak tidak membuat seluruh panel
 * admin jadi layar putih. Sebelumnya kegagalan render (mis. objek sqlc mentah
 * ikut dirender sebagai React child) menjatuhkan seluruh aplikasi tanpa pesan.
 *
 * Error boundary hanya bisa berupa class component — belum ada padanan hook.
 */
export default class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary]', this.props.label ?? '', error, info.componentStack);
  }

  reset = () => this.setState({ error: null });

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="mx-auto max-w-lg space-y-4 rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-center">
        <div className="mx-auto flex size-11 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
          <AlertTriangle className="size-5" />
        </div>
        <div className="space-y-1">
          <p className="font-medium">
            {this.props.label ? `${this.props.label} gagal ditampilkan` : 'Terjadi kesalahan'}
          </p>
          <p className="text-sm text-muted-foreground break-words">{error.message}</p>
        </div>
        <Button variant="outline" onClick={this.reset}>
          <RotateCcw className="size-4" />
          Coba lagi
        </Button>
      </div>
    );
  }
}
