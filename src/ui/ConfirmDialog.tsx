import { AppText } from './AppText';
import { GameButton } from './primitives/GameButton';
import { Overlay } from './primitives/Overlay';
import { colors } from './theme';

interface ConfirmDialogProps {
  visible: boolean;
  title: string;
  message?: string;
  confirmLabel: string;
  cancelLabel: string;
  /** Действие необратимо/разрушительно — кнопка подтверждения красная. */
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/** Подтверждение в стиле приложения вместо системного Alert (спека 04). */
export function ConfirmDialog({
  visible,
  title,
  message,
  confirmLabel,
  cancelLabel,
  destructive = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!visible) return null;

  return (
    <Overlay>
      <AppText preset="title" style={{ textAlign: 'center' }}>
        {title}
      </AppText>
      {message ? (
        <AppText preset="body" style={{ textAlign: 'center', color: colors.textDim }}>
          {message}
        </AppText>
      ) : null}
      <GameButton
        label={confirmLabel}
        variant={destructive ? 'danger' : 'primary'}
        onPress={onConfirm}
      />
      <GameButton label={cancelLabel} variant="ghost" onPress={onCancel} />
    </Overlay>
  );
}
