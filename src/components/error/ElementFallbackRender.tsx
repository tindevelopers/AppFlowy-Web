import { Alert } from '@mui/material';
import { FallbackProps } from 'react-error-boundary';
import i18n from 'i18next';

function sanitizeSlateJson(jsonStr: string): string {
  try {
    const parsed = JSON.parse(jsonStr);
    const sanitize = (val: any): any => {
      if (!val || typeof val !== 'object') return val;
      if (Array.isArray(val)) return val.map(sanitize);
      const res: any = {};

      for (const key of Object.keys(val)) {
        if (key === 'text' && typeof val[key] === 'string') {
          res[key] = '[REDACTED]';
        } else {
          res[key] = sanitize(val[key]);
        }
      }

      return res;
    };

    return JSON.stringify(sanitize(parsed));
  } catch {
    return jsonStr;
  }
}

export function ElementFallbackRender({
  error,
  description,
}: FallbackProps & {
  description?: string;
}) {
  // Use i18n.t directly instead of useTranslation hook to avoid context dependency
  // This prevents crashes when error boundary renders outside of I18nextProvider
  const errorLabel = i18n.isInitialized ? i18n.t('error.generalError') : 'Something went wrong';

  let displayMessage = error?.message || '';

  if (displayMessage.includes('Cannot resolve a DOM node from Slate node:')) {
    const parts = displayMessage.split('Cannot resolve a DOM node from Slate node:');
    const jsonPart = parts[1]?.trim();

    if (jsonPart) {
      displayMessage = 'Cannot resolve a DOM node from Slate node: ' + sanitizeSlateJson(jsonPart);
    } else {
      displayMessage = 'Cannot resolve a DOM node from Slate node: [REDACTED]';
    }
  }

  let displayDescription = description;

  if (displayDescription) {
    displayDescription = sanitizeSlateJson(displayDescription);
  }

  return (
    <Alert severity={'error'} variant={'standard'} contentEditable={false} className={'my-2 overflow-hidden'}>
      <p>{errorLabel}:</p>
      <pre className={'truncate'}>{displayMessage}</pre>
      {displayDescription && <pre>{displayDescription}</pre>}
    </Alert>
  );
}
