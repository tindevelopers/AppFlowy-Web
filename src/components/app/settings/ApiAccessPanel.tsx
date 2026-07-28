import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

import { ApiKeyService } from '@/application/services/domains';
import type {
  ApiKey,
  CreateApiKeyPayload,
  CreateApiKeyResponse,
} from '@/application/services/domains/api-key';
import { ReactComponent as ChevronDownIcon } from '@/assets/icons/alt_arrow_down.svg';
import { ReactComponent as CopyIcon } from '@/assets/icons/copy.svg';
import { ReactComponent as KeyIcon } from '@/assets/icons/key.svg';
import { useCurrentWorkspaceId } from '@/components/app/app.hooks';
import { defaultConfig } from '@/components/main/app.hooks';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { getErrorMessage } from '@/utils/errors';

export function ApiAccessPanel() {
  const { t } = useTranslation();
  const currentWorkspaceId = useCurrentWorkspaceId();

  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loadingKeys, setLoadingKeys] = useState(false);
  const [creating, setCreating] = useState(false);

  // Create key dialog state
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [newKeyWorkspace, setNewKeyWorkspace] = useState<'current' | 'all'>('current');
  const [newKeyExpiry, setNewKeyExpiry] = useState<'never' | '30d' | '90d'>('never');

  // Show-once modal state
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [createdKey, setCreatedKey] = useState<CreateApiKeyResponse | null>(null);
  const [keyCopied, setKeyCopied] = useState(false);

  // Revoke confirm state
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [showRevokeConfirm, setShowRevokeConfirm] = useState(false);

  const loadKeys = useCallback(async () => {
    setLoadingKeys(true);
    try {
      const result = await ApiKeyService.list();

      setKeys(result);
    } catch (e: unknown) {
      toast.error(getErrorMessage(e) || t('settings.apiAccess.errors.loadFailed'));
    } finally {
      setLoadingKeys(false);
    }
  }, [t]);

  useEffect(() => {
    void loadKeys();
  }, [loadKeys]);

  const handleCopy = useCallback(
    async (text: string, label: string) => {
      try {
        await navigator.clipboard.writeText(text);
        toast.success(t('settings.apiAccess.copied', { label }));
      } catch {
        toast.error(t('settings.apiAccess.errors.copyFailed'));
      }
    },
    [t]
  );

  const handleCreateKey = useCallback(async () => {
    if (!newKeyName.trim()) return;
    setCreating(true);
    try {
      const payload: CreateApiKeyPayload = {
        name: newKeyName.trim(),
        workspace_id: newKeyWorkspace === 'current' ? currentWorkspaceId ?? null : null,
      };

      if (newKeyExpiry === '30d') {
        const d = new Date();

        d.setDate(d.getDate() + 30);
        payload.expires_at = d.toISOString();
      } else if (newKeyExpiry === '90d') {
        const d = new Date();

        d.setDate(d.getDate() + 90);
        payload.expires_at = d.toISOString();
      }

      const result = await ApiKeyService.create(payload);

      setCreatedKey(result);
      setShowCreateDialog(false);
      setShowKeyModal(true);
      setNewKeyName('');
      void loadKeys();
    } catch (e: unknown) {
      toast.error(getErrorMessage(e) || t('settings.apiAccess.errors.createFailed'));
    } finally {
      setCreating(false);
    }
  }, [newKeyName, newKeyWorkspace, newKeyExpiry, currentWorkspaceId, t, loadKeys]);

  const handleCopyKey = useCallback(async () => {
    if (!createdKey?.key) return;
    try {
      await navigator.clipboard.writeText(createdKey.key);
      setKeyCopied(true);
    } catch {
      toast.error(t('settings.apiAccess.errors.copyFailed'));
    }
  }, [createdKey, t]);

  const handleCloseKeyModal = useCallback(() => {
    setShowKeyModal(false);
    setCreatedKey(null);
    setKeyCopied(false);
  }, []);

  const handleRevoke = useCallback(
    async (keyId: string) => {
      try {
        await ApiKeyService.revoke(keyId);
        setShowRevokeConfirm(false);
        setRevokingId(null);
        void loadKeys();
      } catch (e: unknown) {
        toast.error(getErrorMessage(e) || t('settings.apiAccess.errors.revokeFailed'));
      }
    },
    [t, loadKeys]
  );

  const openCreateDialog = useCallback(() => {
    setNewKeyName('');
    setNewKeyWorkspace('current');
    setNewKeyExpiry('never');
    setShowCreateDialog(true);
  }, []);

  const connectionInfo = useMemo(
    () => [
      { label: t('settings.apiAccess.connection.baseUrl'), value: defaultConfig.baseURL },
      { label: t('settings.apiAccess.connection.gotrueUrl'), value: defaultConfig.gotrueURL },
      { label: t('settings.apiAccess.connection.wsUrl'), value: defaultConfig.wsURL || t('settings.apiAccess.connection.notConfigured') },
      { label: t('settings.apiAccess.connection.workspaceId'), value: currentWorkspaceId ?? t('settings.apiAccess.connection.notConfigured') },
    ],
    [t, currentWorkspaceId]
  );

  const activeKeys = useMemo(() => keys.filter((k) => !k.revoked_at), [keys]);
  const revokedKeys = useMemo(() => keys.filter((k) => k.revoked_at), [keys]);

  return (
    <div className='flex h-full min-h-0 flex-1 flex-col overflow-hidden'>
      <div className='border-b border-border-primary px-8 py-5'>
        <h2 className='text-xl font-semibold text-text-primary'>{t('settings.apiAccess.title')}</h2>
        <p className='mt-1 text-sm text-text-secondary'>{t('settings.apiAccess.description')}</p>
      </div>

      <div className='appflowy-scroller flex-1 overflow-y-auto px-8 py-6'>
        {/* Connection Info */}
        <section className='mb-6'>
          <h3 className='mb-3 text-base font-semibold text-text-primary'>{t('settings.apiAccess.connection.title')}</h3>
          <div className='rounded-md border border-border-primary bg-surface-container-layer-01 p-4'>
            {connectionInfo.map((item) => (
              <div key={item.label} className='flex items-center justify-between py-1.5'>
                <span className='text-sm text-text-secondary min-w-[120px]'>{item.label}</span>
                <div className='flex items-center gap-2 min-w-0'>
                  <span className='text-sm text-text-primary truncate font-mono'>{item.value}</span>
                  <Button
                    variant='ghost'
                    size='icon-sm'
                    onClick={() => handleCopy(item.value, item.label)}
                    aria-label={t('settings.apiAccess.copy', { label: item.label })}
                  >
                    <CopyIcon className='h-3.5 w-3.5' />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </section>

        <div className='border-b border-border-primary' />

        {/* API Keys */}
        <section className='mt-6'>
          <div className='flex items-center justify-between mb-4'>
            <div>
              <h3 className='text-base font-semibold text-text-primary'>{t('settings.apiAccess.keys.title')}</h3>
              <p className='mt-1 text-sm text-text-secondary'>{t('settings.apiAccess.keys.description')}</p>
            </div>
            <Button
              variant='default'
              size='lg'
              onClick={openCreateDialog}
              data-testid='api-access-create-key'
              disabled={activeKeys.length >= 20}
            >
              {t('settings.apiAccess.keys.createButton')}
            </Button>
          </div>

          {activeKeys.length === 0 && revokedKeys.length === 0 && !loadingKeys && (
            <div className='rounded-md border border-border-primary p-8 text-center text-sm text-text-secondary'>
              <KeyIcon className='mx-auto mb-3 h-8 w-8 text-icon-tertiary' />
              <p>{t('settings.apiAccess.keys.noKeys')}</p>
            </div>
          )}

          {loadingKeys && (
            <div className='rounded-md border border-border-primary p-8 text-center text-sm text-text-secondary'>
              <p>{t('settings.apiAccess.keys.loading')}</p>
            </div>
          )}

          {activeKeys.length > 0 && (
            <div className='rounded-md border border-border-primary overflow-hidden'>
              <table className='w-full text-sm'>
                <thead>
                  <tr className='border-b border-border-primary bg-surface-container-layer-01'>
                    <th className='px-4 py-2.5 text-left font-medium text-text-secondary'>{t('settings.apiAccess.keys.columnName')}</th>
                    <th className='px-4 py-2.5 text-left font-medium text-text-secondary'>{t('settings.apiAccess.keys.columnPrefix')}</th>
                    <th className='px-4 py-2.5 text-left font-medium text-text-secondary hidden sm:table-cell'>{t('settings.apiAccess.keys.columnCreated')}</th>
                    <th className='px-4 py-2.5 text-left font-medium text-text-secondary hidden sm:table-cell'>{t('settings.apiAccess.keys.columnLastUsed')}</th>
                    <th className='px-4 py-2.5 text-left font-medium text-text-secondary hidden sm:table-cell'>{t('settings.apiAccess.keys.columnExpires')}</th>
                    <th className='px-4 py-2.5 text-right font-medium text-text-secondary'>{t('settings.apiAccess.keys.columnActions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {activeKeys.map((key) => (
                    <tr key={key.id} className='border-b border-border-primary last:border-b-0 hover:bg-fill-content-hover'>
                      <td className='px-4 py-2.5 text-text-primary'>{key.name}</td>
                      <td className='px-4 py-2.5 text-text-secondary font-mono'>{key.key_prefix}</td>
                      <td className='px-4 py-2.5 text-text-secondary hidden sm:table-cell'>
                        {new Date(key.created_at).toLocaleDateString()}
                      </td>
                      <td className='px-4 py-2.5 text-text-secondary hidden sm:table-cell'>
                        {key.last_used_at ? new Date(key.last_used_at).toLocaleDateString() : '—'}
                      </td>
                      <td className='px-4 py-2.5 text-text-secondary hidden sm:table-cell'>
                        {key.expires_at ? new Date(key.expires_at).toLocaleDateString() : t('settings.apiAccess.keys.never')}
                      </td>
                      <td className='px-4 py-2.5 text-right'>
                        <Button
                          variant='destructive-outline'
                          size='sm'
                          onClick={() => {
                            setRevokingId(key.id);
                            setShowRevokeConfirm(true);
                          }}
                          data-testid={`api-key-revoke-${key.key_prefix}`}
                        >
                          {t('settings.apiAccess.keys.revoke')}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      {/* Create Key Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className='sm:max-w-[440px]'>
          <DialogHeader>
            <DialogTitle>{t('settings.apiAccess.keys.createDialogTitle')}</DialogTitle>
            <DialogDescription>{t('settings.apiAccess.keys.createDialogDescription')}</DialogDescription>
          </DialogHeader>
          <div className='flex flex-col gap-4 py-3'>
            <div className='flex flex-col gap-2'>
              <Label htmlFor='key-name'>{t('settings.apiAccess.keys.nameLabel')}</Label>
              <Input
                id='key-name'
                value={newKeyName}
                onChange={(e) => setNewKeyName(e.target.value)}
                placeholder={t('settings.apiAccess.keys.namePlaceholder')}
                data-testid='api-key-name-input'
              />
            </div>
            <DropdownField
              label={t('settings.apiAccess.keys.workspaceScopeLabel')}
              value={newKeyWorkspace}
              onValueChange={(v) => setNewKeyWorkspace(v as 'current' | 'all')}
              items={[
                { value: 'current', label: t('settings.apiAccess.keys.scopeCurrentWorkspace') },
                { value: 'all', label: t('settings.apiAccess.keys.scopeAllWorkspaces') },
              ]}
              testId='api-key-workspace-select'
            />
            <DropdownField
              label={t('settings.apiAccess.keys.expiryLabel')}
              value={newKeyExpiry}
              onValueChange={(v) => setNewKeyExpiry(v as 'never' | '30d' | '90d')}
              items={[
                { value: 'never', label: t('settings.apiAccess.keys.expiryNever') },
                { value: '30d', label: t('settings.apiAccess.keys.expiry30d') },
                { value: '90d', label: t('settings.apiAccess.keys.expiry90d') },
              ]}
              testId='api-key-expiry-select'
            />
          </div>
          <DialogFooter>
            <Button variant='outline' onClick={() => setShowCreateDialog(false)} disabled={creating}>
              {t('button.cancel')}
            </Button>
            <Button
              variant='default'
              onClick={handleCreateKey}
              loading={creating}
              disabled={!newKeyName.trim()}
              data-testid='api-key-create-submit'
            >
              {t('settings.apiAccess.keys.createButton')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Show-Once Key Modal */}
      <Dialog open={showKeyModal} onOpenChange={handleCloseKeyModal}>
        <DialogContent className='sm:max-w-[480px]'>
          <DialogHeader>
            <DialogTitle>{t('settings.apiAccess.keys.createdTitle')}</DialogTitle>
            <DialogDescription>{t('settings.apiAccess.keys.createdWarning')}</DialogDescription>
          </DialogHeader>
          <div className='flex flex-col gap-4 py-3'>
            <div className='rounded-md border border-border-primary bg-surface-container-layer-01 p-4'>
              <span className='block text-xs text-text-secondary mb-1'>{t('settings.apiAccess.keys.keyLabel')}</span>
              <span className='block text-sm text-text-primary font-mono break-all select-all' data-testid='api-key-created-value'>
                {createdKey?.key}
              </span>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant='outline'
              onClick={handleCloseKeyModal}
            >
              {t('button.close')}
            </Button>
            <Button
              variant='default'
              onClick={handleCopyKey}
              disabled={keyCopied}
              data-testid='api-key-copy-btn'
            >
              {keyCopied ? t('settings.apiAccess.copiedLabel') : t('settings.apiAccess.keys.copyKey')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Revoke Confirm Dialog */}
      <Dialog open={showRevokeConfirm} onOpenChange={setShowRevokeConfirm}>
        <DialogContent className='sm:max-w-[400px]'>
          <DialogHeader>
            <DialogTitle>{t('settings.apiAccess.keys.revokeConfirmTitle')}</DialogTitle>
            <DialogDescription>
              {t('settings.apiAccess.keys.revokeConfirmDescription')}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant='outline' onClick={() => { setShowRevokeConfirm(false); setRevokingId(null); }}>
              {t('button.cancel')}
            </Button>
            <Button
              variant='destructive'
              onClick={() => revokingId && handleRevoke(revokingId)}
              data-testid='api-key-revoke-confirm'
            >
              {t('settings.apiAccess.keys.revoke')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default ApiAccessPanel;

const triggerCls =
  'flex h-8 w-[260px] cursor-pointer items-center gap-1 rounded-300 border px-2 text-sm font-normal';

function DropdownField({
  label,
  value,
  onValueChange,
  items,
  testId,
}: {
  label: string;
  value: string;
  onValueChange: (v: string) => void;
  items: { value: string; label: string }[];
  testId: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const selected = items.find((i) => i.value === value) || items[0];

  return (
    <div className='flex flex-col gap-2'>
      <Label>{label}</Label>
      <DropdownMenu open={isOpen} onOpenChange={setIsOpen} modal={false}>
        <DropdownMenuTrigger
          data-testid={testId}
          asChild
          onPointerDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          onClick={() => setIsOpen((p) => !p)}
        >
          <div
            className={cn(
              triggerCls,
              isOpen ? 'border-border-theme-thick' : 'border-border-primary hover:border-border-primary-hover'
            )}
          >
            <span className='flex-1 truncate'>{selected.label}</span>
            <ChevronDownIcon className='h-4 w-4 text-icon-primary' />
          </div>
        </DropdownMenuTrigger>
        <DropdownMenuContent align='start'>
          <DropdownMenuRadioGroup value={value} onValueChange={onValueChange}>
            {items.map((item) => (
              <DropdownMenuRadioItem key={item.value} value={item.value}>
                {item.label}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
