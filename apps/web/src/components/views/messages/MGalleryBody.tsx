/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type JSX, useEffect, useMemo } from "react";
import { EventType, MatrixEvent, MsgType } from "matrix-js-sdk/src/matrix";

import { type IBodyProps } from "./IBodyProps";
import MVoiceOrAudioBody from "./MVoiceOrAudioBody";
import { FileBodyFactory, ImageBodyFactory, VideoBodyFactory } from "./MBodyFactory";
import { TextualBodyFactory } from "./TextualBodyFactory";
import { type ImageViewerGroup } from "./NavigableImageViewDialog";
import { MediaEventHelper } from "../../../utils/MediaEventHelper";
import { type GalleryContent, type GalleryItemContent } from "../../../utils/GalleryContent";

interface GalleryItem {
    key: string;
    event: MatrixEvent;
    mediaEventHelper: MediaEventHelper;
}

/**
 * Work out how an item should be rendered. Items which claim to be an image or video but carry
 * a mimetype of a different kind are downgraded to plain files, as MessageEvent does for
 * regular image and video messages.
 */
function getItemMsgType(item: GalleryItemContent): MsgType {
    const mimeMajor = item.info?.mimetype?.split("/")[0];
    switch (item.itemtype) {
        case MsgType.Image:
            return mimeMajor === undefined || mimeMajor === "image" ? MsgType.Image : MsgType.File;
        case MsgType.Video:
            return mimeMajor === undefined || mimeMajor === "video" ? MsgType.Video : MsgType.File;
        case MsgType.Audio:
            return mimeMajor === undefined || mimeMajor === "audio" ? MsgType.Audio : MsgType.File;
        default:
            return MsgType.File;
    }
}

/**
 * Turn each item of a gallery event into a synthetic message event of its own, so that the
 * existing image, video, audio and file bodies (and their handling of encrypted media,
 * thumbnails and the image viewer) can be reused for it.
 */
function buildItems(mxEvent: MatrixEvent): GalleryItem[] {
    const { itemtypes } = mxEvent.getContent<GalleryContent>();
    if (!Array.isArray(itemtypes)) return [];

    return itemtypes
        .filter((item) => !!item && (item.url || item.file))
        .map((item, index) => {
            const { itemtype, ...rest } = item;
            const event = new MatrixEvent({
                type: EventType.RoomMessage,
                room_id: mxEvent.getRoomId(),
                sender: mxEvent.getSender(),
                origin_server_ts: mxEvent.getTs(),
                event_id: `${mxEvent.getId()}:gallery:${index}`,
                content: { ...rest, msgtype: getItemMsgType(item) },
            });
            return { key: event.getId()!, event, mediaEventHelper: new MediaEventHelper(event) };
        });
}

function GalleryItemBody({
    item,
    bodyProps,
    imageViewerGroup,
}: {
    item: GalleryItem;
    bodyProps: IBodyProps;
    imageViewerGroup?: ImageViewerGroup;
}): JSX.Element {
    const props: IBodyProps = {
        ...bodyProps,
        ref: undefined,
        mxEvent: item.event,
        mediaEventHelper: item.mediaEventHelper,
        // The caption belongs to the gallery as a whole, not the individual items.
        showFileInfo: false,
        imageViewerGroup,
    };

    switch (item.event.getContent().msgtype) {
        case MsgType.Image:
            return <ImageBodyFactory {...props} />;
        case MsgType.Video:
            return <VideoBodyFactory {...props} />;
        case MsgType.Audio:
            return <MVoiceOrAudioBody {...props} />;
        default:
            return <FileBodyFactory {...props} />;
    }
}

/**
 * Renders a gallery message (MSC4274): several media items sent together, with one optional caption.
 */
export default function MGalleryBody(props: IBodyProps): JSX.Element {
    const { mxEvent } = props;
    const content = mxEvent.getContent<GalleryContent>();

    // eslint-disable-next-line react-hooks/exhaustive-deps -- the items are rebuilt only when the content changes
    const items = useMemo(() => buildItems(mxEvent), [mxEvent, content.itemtypes]);

    useEffect(() => {
        return () => items.forEach((item) => item.mediaEventHelper.destroy());
    }, [items]);

    // Opening one of the images in the viewer lets it flip through the other images of the gallery.
    const imageViewerGroups = useMemo(() => {
        const images = items.filter((item) => item.event.getContent().msgtype === MsgType.Image);
        const viewerItems = images.map(({ event, mediaEventHelper }) => ({ mxEvent: event, mediaEventHelper }));
        return new Map(images.map((item, index) => [item.key, { items: viewerItems, index }]));
    }, [items]);

    return (
        <div className="mx_EventTile_content">
            <div className="mx_MGalleryBody" data-count={items.length}>
                {items.map((item) => (
                    <div className="mx_MGalleryBody_item" key={item.key}>
                        <GalleryItemBody
                            item={item}
                            bodyProps={props}
                            imageViewerGroup={imageViewerGroups.get(item.key)}
                        />
                    </div>
                ))}
            </div>
            {content.body ? <TextualBodyFactory {...props} ref={undefined} /> : null}
        </div>
    );
}
