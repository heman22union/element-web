/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { EventType, MatrixEvent } from "matrix-js-sdk/src/matrix";
import { render, screen } from "test-utils-rtl";

import { stubClient } from "test-utils";

import MGalleryBody from "./MGalleryBody";
import { GALLERY_MSGTYPE, type GalleryItemContent } from "../../../utils/GalleryContent";
import { type IBodyProps } from "./IBodyProps";

// Replace the bodies of the individual items with markers recording what they were asked to render.
vi.mock("./MBodyFactory", () => {
    const marker = (kind: string) => (props: IBodyProps) => (
        <div data-testid="item" data-kind={kind} data-id={props.mxEvent.getId()} />
    );
    return {
        ImageBodyFactory: marker("image"),
        VideoBodyFactory: marker("video"),
        FileBodyFactory: marker("file"),
    };
});
vi.mock("./MVoiceOrAudioBody", () => ({
    default: (props: IBodyProps) => <div data-testid="item" data-kind="audio" data-id={props.mxEvent.getId()} />,
}));
vi.mock("./TextualBodyFactory", () => ({
    TextualBodyFactory: (props: IBodyProps) => <div data-testid="caption">{props.mxEvent.getContent().body}</div>,
}));

function renderGallery(body: string, itemtypes?: GalleryItemContent[]): ReturnType<typeof render> {
    const mxEvent = new MatrixEvent({
        room_id: "!room:server",
        sender: "@sender:server",
        type: EventType.RoomMessage,
        event_id: "$gallery",
        content: { msgtype: GALLERY_MSGTYPE, body, itemtypes },
    });
    return render(<MGalleryBody mxEvent={mxEvent} />);
}

const image = (name: string, mimetype = "image/png"): GalleryItemContent => ({
    itemtype: "m.image",
    body: name,
    url: `mxc://server/${name}`,
    info: { mimetype },
});

describe("MGalleryBody", () => {
    beforeEach(() => {
        stubClient();
    });

    it("renders one body per item and the caption", () => {
        renderGallery("holiday", [image("a.png"), image("b.png"), image("c.png")]);

        expect(screen.getAllByTestId("item").map((el) => el.dataset.id)).toEqual([
            "$gallery:gallery:0",
            "$gallery:gallery:1",
            "$gallery:gallery:2",
        ]);
        expect(screen.getByTestId("caption")).toHaveTextContent("holiday");
    });

    it("renders no caption when the gallery has none", () => {
        renderGallery("", [image("a.png")]);

        expect(screen.getAllByTestId("item")).toHaveLength(1);
        expect(screen.queryByTestId("caption")).not.toBeInTheDocument();
    });

    it("picks the body by item type", () => {
        renderGallery("", [
            image("a.png"),
            { itemtype: "m.video", body: "b.mp4", url: "mxc://server/b", info: { mimetype: "video/mp4" } },
            { itemtype: "m.audio", body: "c.ogg", url: "mxc://server/c", info: { mimetype: "audio/ogg" } },
            { itemtype: "m.file", body: "d.pdf", url: "mxc://server/d" },
            { itemtype: "org.example.unknown", body: "e", url: "mxc://server/e" },
        ]);

        expect(screen.getAllByTestId("item").map((el) => el.dataset.kind)).toEqual([
            "image",
            "video",
            "audio",
            "file",
            "file",
        ]);
    });

    it("downgrades items whose mimetype does not match their type to files", () => {
        renderGallery("", [image("a.png", "text/html"), image("b.png", "image/jpeg")]);

        expect(screen.getAllByTestId("item").map((el) => el.dataset.kind)).toEqual(["file", "image"]);
    });

    it("skips items without any media and tolerates a missing item list", () => {
        const { unmount } = renderGallery("", [{ itemtype: "m.image", body: "broken" }, image("a.png")]);
        expect(screen.getAllByTestId("item")).toHaveLength(1);
        unmount();

        renderGallery("just a caption", undefined);
        expect(screen.queryAllByTestId("item")).toHaveLength(0);
        expect(screen.getByTestId("caption")).toHaveTextContent("just a caption");
    });

    it("renders encrypted items", () => {
        renderGallery("", [
            {
                itemtype: "m.image",
                body: "secret.png",
                file: { url: "mxc://server/secret" } as GalleryItemContent["file"],
                info: { mimetype: "image/png" },
            },
        ]);

        expect(screen.getAllByTestId("item")).toHaveLength(1);
    });
});
