/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type EncryptedFile } from "matrix-js-sdk/src/types";

/**
 * The msgtype used by gallery messages, as defined by the (not yet stable) MSC4274
 * "Inline media galleries via msgtypes".
 * @see https://github.com/matrix-org/matrix-spec-proposals/pull/4274
 */
export const GALLERY_MSGTYPE = "dm.filament.gallery";

/** A single item of a gallery message. */
export interface GalleryItemContent {
    /** The type of the item, using the same values as the msgtype of a regular media message. */
    itemtype: string;
    body: string;
    filename?: string;
    url?: string;
    file?: EncryptedFile;
    info?: { mimetype?: string } & Record<string, unknown>;
}

/** The content of a gallery message. The `body` is the caption of the whole gallery. */
export interface GalleryContent {
    msgtype: typeof GALLERY_MSGTYPE;
    body: string;
    format?: string;
    formatted_body?: string;
    itemtypes?: GalleryItemContent[];
}
