import { Button, CircularProgress, Divider, Tooltip, Typography } from '@mui/material';
import React, { useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import { AccessLevel, View, ViewLayout } from '@/application/types';
import { ReactComponent as CheckboxCheckSvg } from '@/assets/icons/check_filled.svg';
import { ReactComponent as PublishIcon } from '@/assets/icons/earth.svg';
import { ReactComponent as CheckboxUncheckSvg } from '@/assets/icons/uncheck.svg';
import { notify } from '@/components/_shared/notify';
import { Switch } from '@/components/_shared/switch';
import PageIcon from '@/components/_shared/view-icon/PageIcon';
import { usePublishing } from '@/components/app/app.hooks';
import { useLoadPublishInfo } from '@/components/app/share/publish.hooks';
import PublishLinkPreview from '@/components/app/share/PublishLinkPreview';

function PublishPanel({
  viewId,
  opened,
  onClose,
  onOpenPublishManage,
  currentUserAccessLevel,
  shareDetailsLoading,
}: {
  viewId: string;
  onClose: () => void;
  opened: boolean;
  onOpenPublishManage?: () => void;
  currentUserAccessLevel?: AccessLevel;
  shareDetailsLoading?: boolean;
}) {
  const { t } = useTranslation();
  const { publish, unpublish, loadDescendantViews, publishSubtree } = usePublishing();
  const {
    url,
    loadPublishInfo,
    view,
    publishInfo,
    publishInfoViewId,
    loading,
    isOwner,
    isPublisher,
    updatePublishConfig,
  } = useLoadPublishInfo(viewId);
  const [unpublishLoading, setUnpublishLoading] = React.useState<boolean>(false);
  const [publishLoading, setPublishLoading] = React.useState<boolean>(false);
  // Track publish/unpublish actions locally so the panel updates immediately,
  // even when the view object (e.g. server fallback) has a stale is_published flag.
  const [publishedOverride, setPublishedOverride] = React.useState<boolean | undefined>(undefined);
  const [visibleViewId, setVisibleViewId] = React.useState<string[] | undefined>(undefined);
  const [commentEnabled, setCommentEnabled] = React.useState<boolean | undefined>(undefined);
  const [duplicateEnabled, setDuplicateEnabled] = React.useState<boolean | undefined>(undefined);
  // "Also publish all subpages" cascade — a separate feature from single-page
  // publish. Lets the user publish a page's descendant subtree in one action.
  const [publishSubpages, setPublishSubpages] = React.useState<boolean>(false);
  const [includeDrafts, setIncludeDrafts] = React.useState<boolean>(true);
  const [descendantViews, setDescendantViews] = React.useState<View[] | undefined>(undefined);
  const [descendantsLoading, setDescendantsLoading] = React.useState<boolean>(false);
  const [cascadeProgress, setCascadeProgress] = React.useState<{ done: number; total: number } | undefined>(
    undefined
  );

  // Reset session-local overrides when the target view changes
  useEffect(() => {
    setPublishedOverride(undefined);
    setPublishSubpages(false);
    setIncludeDrafts(true);
    setDescendantViews(undefined);
    setCascadeProgress(undefined);
  }, [viewId]);

  // Fetch the descendant subtree once "Also publish all subpages" is enabled,
  // so the panel can show a live count before the user commits to publishing.
  useEffect(() => {
    if (!publishSubpages || !view || descendantViews !== undefined || !loadDescendantViews) return;

    let cancelled = false;

    setDescendantsLoading(true);
    void loadDescendantViews(view.view_id)
      .then((views) => {
        if (!cancelled) setDescendantViews(views);
      })
      .catch(() => {
        if (!cancelled) setDescendantViews([]);
      })
      .finally(() => {
        if (!cancelled) setDescendantsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [publishSubpages, view, descendantViews, loadDescendantViews]);

  useEffect(() => {
    if (opened) {
      void loadPublishInfo();
    }
  }, [loadPublishInfo, opened]);

  useEffect(() => {
    if (opened && publishInfo && publishInfoViewId === viewId) {
      setCommentEnabled(publishInfo.commentEnabled);
      setDuplicateEnabled(publishInfo.duplicateEnabled);
    }
  }, [opened, publishInfo, publishInfoViewId, viewId]);

  const handlePublish = useCallback(
    async (publishName?: string) => {
      if (!publish || !view) return;

      setPublishLoading(true);
      const newPublishName = publishName || publishInfo?.publishName || undefined;

      try {
        await publish(view, newPublishName, visibleViewId);

        let cascadeResult: Awaited<ReturnType<NonNullable<typeof publishSubtree>>> | undefined;

        if (publishSubpages && publishSubtree) {
          const views = descendantViews ?? (await loadDescendantViews?.(view.view_id)) ?? [];

          if (views.length > 0) {
            cascadeResult = await publishSubtree(views, { includeDrafts }, (done, total) => {
              setCascadeProgress({ done, total });
            });
          }
        }

        setPublishedOverride(true);
        await loadPublishInfo();

        if (cascadeResult && cascadeResult.failed > 0) {
          notify.error(
            t('shareAction.publishSubpagesPartialFailure', {
              succeeded: cascadeResult.succeeded,
              failed: cascadeResult.failed,
            })
          );
        } else if (cascadeResult && cascadeResult.succeeded > 0) {
          notify.success(t('shareAction.publishWithSubpagesSuccess', { count: cascadeResult.succeeded }));
        } else {
          notify.success(t('publish.publishSuccessfully'));
        }
        // eslint-disable-next-line
      } catch (e: any) {
        notify.error(e.message);
      } finally {
        setPublishLoading(false);
        setCascadeProgress(undefined);
      }
    },
    [
      loadPublishInfo,
      publish,
      t,
      view,
      publishInfo,
      visibleViewId,
      publishSubpages,
      publishSubtree,
      descendantViews,
      loadDescendantViews,
      includeDrafts,
    ]
  );

  const handleUnpublish = useCallback(async () => {
    if (!view || !unpublish) return;
    if (!isOwner && !isPublisher) {
      notify.error(t('settings.sites.error.unPublishPermissionDenied'));
      return;
    }

    setUnpublishLoading(true);

    try {
      await unpublish(viewId);
      setPublishedOverride(false);
      await loadPublishInfo();
      notify.success(t('publish.unpublishSuccessfully'));
      // eslint-disable-next-line
    } catch (e: any) {
      notify.error(e.message);
    } finally {
      setUnpublishLoading(false);
    }
  }, [isOwner, isPublisher, loadPublishInfo, t, unpublish, view, viewId]);

  const scopedPublishInfo = publishInfoViewId === viewId ? publishInfo : undefined;

  const renderPublished = useCallback(() => {
    if (!scopedPublishInfo || !view) return null;
    return (
      <div className={'flex flex-col gap-5'}>
        <PublishLinkPreview
          viewId={viewId}
          publishInfo={scopedPublishInfo}
          url={url}
          updatePublishConfig={updatePublishConfig}
          onUnPublish={handleUnpublish}
          isOwner={isOwner}
          isPublisher={isPublisher}
          onClose={onClose}
          onOpenPublishManage={onOpenPublishManage}
        />
        <div className={'flex w-full items-center justify-end gap-4'}>
          <Button
            className={'max-w-[50%] flex-1'}
            onClick={() => {
              void handleUnpublish();
            }}
            color={'inherit'}
            variant={'outlined'}
            startIcon={unpublishLoading ? <CircularProgress size={16} /> : undefined}
            data-testid={'unpublish-button'}
          >
            {t('shareAction.unPublish')}
          </Button>
          <Button
            className={'max-w-[50%] flex-1'}
            onClick={() => {
              window.open(url, '_blank');
            }}
            data-testid={'visit-site-button'}
            variant={'contained'}
          >
            {t('shareAction.visitSite')}
          </Button>
        </div>
        <div className={'flex flex-col'}>
          <div className={'flex items-center justify-between gap-4 p-1.5 text-sm'}>
            <span>{t('comments')}</span>
            <Switch
              checked={commentEnabled !== false}
              onChange={(e) => {
                setCommentEnabled(e.target.checked);
                void updatePublishConfig({ comments_enabled: e.target.checked, view_id: viewId });
              }}
              size={'small'}
              inputProps={{ 'data-testid': 'publish-comments-switch' } as React.InputHTMLAttributes<HTMLInputElement>}
            />
          </div>
          <div className={'flex  items-center justify-between gap-4 p-1.5 text-sm'}>
            <span>{t('duplicateAsTemplate')}</span>
            <Switch
              checked={duplicateEnabled !== false}
              onChange={(e) => {
                setDuplicateEnabled(e.target.checked);
                void updatePublishConfig({ duplicate_enabled: e.target.checked, view_id: viewId });
              }}
              size={'small'}
            />
          </div>
        </div>
      </div>
    );
  }, [
    scopedPublishInfo,
    view,
    url,
    handleUnpublish,
    isOwner,
    isPublisher,
    onClose,
    unpublishLoading,
    t,
    commentEnabled,
    duplicateEnabled,
    updatePublishConfig,
    viewId,
    onOpenPublishManage,
  ]);

  const layout = view?.layout;
  const isDatabase =
    layout !== undefined ? [ViewLayout.Grid, ViewLayout.Board, ViewLayout.Calendar].includes(layout) : false;
  // Use the publish API (scopedPublishInfo) as the authoritative source.
  // view.is_published from the outline can be stale after unpublish.
  const serverPublishedState = Boolean(scopedPublishInfo);
  // Reconcile local override with fetched/server state:
  // - local override is authoritative for immediate UI feedback
  // - fallback to server-derived state when no local override exists
  const hasPublished = publishedOverride ?? serverPublishedState;

  useEffect(() => {
    if (!hasPublished && isDatabase && view) {
      // Pre-select only the current view, not all children.
      // Users can tick additional tabs if they want them published together.
      setVisibleViewId([view.view_id]);
    } else {
      setVisibleViewId(undefined);
    }
  }, [hasPublished, isDatabase, view]);

  const draftDescendantCount = descendantViews?.filter((v) => !v.is_published).length ?? 0;
  const publishedDescendantCount = (descendantViews?.length ?? 0) - draftDescendantCount;
  const subpagesToPublishCount = includeDrafts ? descendantViews?.length ?? 0 : publishedDescendantCount;

  const renderUnpublished = useCallback(() => {
    if (!view) return null;
    const list = [view, ...view.children];
    const isReadOnlyUser = currentUserAccessLevel === AccessLevel.ReadOnly;
    const publishDisabled = isReadOnlyUser || shareDetailsLoading || publishLoading;
    const publishButton = (
      <Button
        onClick={() => {
          if (isReadOnlyUser) return;
          void handlePublish();
        }}
        variant={'contained'}
        className={'w-full'}
        data-testid={'publish-confirm-button'}
        color={'primary'}
        disabled={publishDisabled}
        startIcon={publishLoading ? <CircularProgress color={'inherit'} size={16} /> : undefined}
      >
        {t('shareAction.publish')}
      </Button>
    );

    return (
      <div className={'flex w-full flex-col gap-4'}>
        {isDatabase && (
          <div className={'mt-2 flex flex-col gap-3 rounded-[16px] border border-border-primary px-4 py-3 text-sm'}>
            <div className={'text-text-secondary'}>
              {t('publishSelectedViews', {
                count: visibleViewId?.length || 0,
              })}
            </div>
            <Divider />
            <div className={'appflowy-scroller flex max-h-[300px] flex-col gap-1 overflow-y-auto overflow-x-hidden'}>
              {list.map((item) => {
                const id = item.view_id;
                const isCurrentView = view.view_id === item.view_id;

                const selected = visibleViewId?.includes(item.view_id);

                return (
                  <Button
                    disabled={isCurrentView}
                    onClick={() => {
                      setVisibleViewId((prev) => {
                        const checked = prev?.includes(id);

                        if (checked) {
                          return prev?.filter((i) => i !== id);
                        } else {
                          return [...(prev || []), id];
                        }
                      });
                    }}
                    key={id}
                    className={'flex items-center justify-start'}
                    size={'small'}
                    startIcon={
                      selected ? (
                        <CheckboxCheckSvg />
                      ) : (
                        <CheckboxUncheckSvg className={'text-border-primary hover:text-border-primary-hover'} />
                      )
                    }
                    color={'inherit'}
                  >
                    <div className={'flex items-center gap-2'}>
                      <PageIcon view={item} className={'h-5 w-5'} />
                      {item.name || t('untitled')}
                    </div>
                  </Button>
                );
              })}
            </div>
          </div>
        )}
        <Tooltip
          disableHoverListener={!isReadOnlyUser}
          title={isReadOnlyUser ? t('shareAction.readOnlyPublishTooltip') : ''}
        >
          <span className={'w-full'}>{publishButton}</span>
        </Tooltip>
        <div className={'flex flex-col gap-3 rounded-[16px] border border-border-primary px-4 py-3 text-sm'}>
          <div className={'flex items-center justify-between gap-4'}>
            <span>{t('shareAction.publishSubpages')}</span>
            <Switch
              checked={publishSubpages}
              onChange={(e) => setPublishSubpages(e.target.checked)}
              size={'small'}
              disabled={publishLoading}
              inputProps={{ 'data-testid': 'publish-subpages-switch' } as React.InputHTMLAttributes<HTMLInputElement>}
            />
          </div>
          {publishSubpages && (
            <>
              <Divider />
              <div className={'flex items-center justify-between gap-4'}>
                <span>{t('shareAction.includeDrafts')}</span>
                <Switch
                  checked={includeDrafts}
                  onChange={(e) => setIncludeDrafts(e.target.checked)}
                  size={'small'}
                  disabled={publishLoading}
                  inputProps={
                    { 'data-testid': 'publish-include-drafts-switch' } as React.InputHTMLAttributes<HTMLInputElement>
                  }
                />
              </div>
              <div className={'text-text-secondary'} data-testid={'publish-subpages-preview'}>
                {descendantsLoading
                  ? t('shareAction.publishSubpagesCounting')
                  : cascadeProgress
                    ? t('shareAction.publishSubpagesProgress', {
                        done: cascadeProgress.done,
                        total: cascadeProgress.total,
                      })
                    : subpagesToPublishCount > 0
                      ? t('shareAction.publishSubpagesPreview', { count: subpagesToPublishCount })
                      : t('shareAction.publishSubpagesNone')}
              </div>
            </>
          )}
        </div>
      </div>
    );
  }, [
    currentUserAccessLevel,
    handlePublish,
    isDatabase,
    publishLoading,
    shareDetailsLoading,
    t,
    view,
    visibleViewId,
    publishSubpages,
    includeDrafts,
    descendantsLoading,
    cascadeProgress,
    subpagesToPublishCount,
  ]);

  return (
    <div className='flex flex-col items-start gap-1 self-stretch px-3 py-4'>
      <div className={'flex w-full flex-col gap-2 overflow-hidden'}>
        <Typography className={'flex items-center gap-1.5'} variant={'body2'}>
          <PublishIcon className={'h-5 w-5'} />
          {t('shareAction.publishToTheWeb')}
        </Typography>
        <Typography className={'text-text-secondary'} variant={'caption'}>
          {t('shareAction.publishToTheWebHint')}
        </Typography>
        {loading && (
          <div className={'flex w-full items-center justify-center'}>
            <CircularProgress size={20} />
          </div>
        )}
        <div
          style={{
            visibility: loading ? 'hidden' : 'visible',
            height: loading ? 0 : 'auto',
          }}
          className={'overflow-hidden'}
        >
          {hasPublished ? renderPublished() : renderUnpublished()}
        </div>
      </div>
    </div>
  );
}

export default PublishPanel;
