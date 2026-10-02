/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type ComponentProps, type JSX, useCallback, useEffect, useState } from "react";
import { type MatrixEvent } from "matrix-js-sdk/src/matrix";
import { type ImageContent } from "matrix-js-sdk/src/types";

import ImageView from "../elements/ImageView";
import { _t } from "../../../languageHandler";
import { type MediaEventHelper } from "../../../utils/MediaEventHelper";
import { isMimeTypeAllowed } from "../../../utils/blobs";
import { type RoomPermalinkCreator } from "../../../utils/permalinks/Permalinks";

/** An image that can be shown in the image viewer. */
export interface ImageViewerItem {
    mxEvent: MatrixEvent;
    mediaEventHelper: MediaEventHelper;
}

/** A set of images that the image viewer can be flipped through, e.g. the images of one gallery message. */
export interface ImageViewerGroup {
    items: ImageViewerItem[];
    /** The index in `items` of the image that is being opened. */
    index: number;
}

type ViewerParams = Omit<ComponentProps<typeof ImageView>, "onFinished" | "onPrevious" | "onNext">;

/**
 * Resolve what the image viewer needs to display an image. Returns null if the image can not be loaded.
 */
async function resolveViewerParams({ mxEvent, mediaEventHelper }: ImageViewerItem): Promise<ViewerParams | null> {
    const content = mxEvent.getContent<ImageContent>();

    let src: string | null = null;
    try {
        src = await mediaEventHelper.sourceUrl.value;
        // As for single images: decrypted content of a type that can't be shown safely is replaced by its thumbnail.
        if (
            mediaEventHelper.media.isEncrypted &&
            !isMimeTypeAllowed(mediaEventHelper.sourceBlob.cachedValue?.type ?? "")
        ) {
            src = await mediaEventHelper.thumbnailUrl.value;
        }
    } catch {
        return null;
    }
    if (!src) return null;

    return {
        src,
        name: content.body && content.body.length > 0 ? content.body : _t("common|attachment"),
        mxEvent,
        width: content.info?.w,
        height: content.info?.h,
        fileSize: content.info?.size,
    };
}

interface IProps {
    group: ImageViewerGroup;
    permalinkCreator?: RoomPermalinkCreator;
    /** Where the opened image was shown, so that the viewer can animate from there. */
    thumbnailInfo?: ComponentProps<typeof ImageView>["thumbnailInfo"];
    onFinished: () => void;
}

/**
 * The image viewer, with previous/next controls to flip through the images of a group.
 */
export default function NavigableImageViewDialog({
    group,
    permalinkCreator,
    thumbnailInfo,
    onFinished,
}: IProps): JSX.Element | null {
    const [index, setIndex] = useState(group.index);
    // The image currently displayed. When navigating, the previous image stays up until the next has loaded.
    const [shown, setShown] = useState<{ index: number; params: ViewerParams } | null>(null);

    useEffect(() => {
        let cancelled = false;
        void resolveViewerParams(group.items[index]).then((params) => {
            if (cancelled) return;
            if (params) setShown({ index, params });
            // An image which can't be loaded is not something to flip to: close if it is the very first one.
            else if (shown === null) onFinished();
        });
        return () => {
            cancelled = true;
        };
        // `shown` is only consulted when loading fails; it must not retrigger loading
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [group, index, onFinished]);

    const onPrevious = useCallback(() => setIndex((i) => Math.max(i - 1, 0)), []);
    const onNext = useCallback(() => setIndex((i) => Math.min(i + 1, group.items.length - 1)), [group.items.length]);

    if (!shown) return null;

    return (
        <ImageView
            // a new viewer per image resets zoom, rotation and position
            key={shown.index}
            {...shown.params}
            permalinkCreator={permalinkCreator}
            // only the image that was clicked can animate out of its place in the timeline
            thumbnailInfo={shown.index === group.index ? thumbnailInfo : undefined}
            onPrevious={shown.index > 0 ? onPrevious : undefined}
            onNext={shown.index < group.items.length - 1 ? onNext : undefined}
            onFinished={onFinished}
        />
    );
}
