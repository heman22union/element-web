/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import React from "react";
import { describe, it, expect, vi } from "vitest";
import { EventType, MatrixEvent } from "matrix-js-sdk/src/matrix";
import { fireEvent, render, screen, waitFor } from "test-utils-rtl";

import NavigableImageViewDialog, { type ImageViewerGroup } from "./NavigableImageViewDialog";
import { type MediaEventHelper } from "../../../utils/MediaEventHelper";

// Replace the viewer by something exposing which image it was given and which navigation it offers.
vi.mock("../elements/ImageView", () => ({
    default: (props: {
        src: string;
        name: string;
        onPrevious?: () => void;
        onNext?: () => void;
        onFinished: () => void;
    }) => (
        <div data-testid="viewer" data-src={props.src} data-name={props.name}>
            {props.onPrevious && <button onClick={props.onPrevious}>previous</button>}
            {props.onNext && <button onClick={props.onNext}>next</button>}
            <button onClick={props.onFinished}>close</button>
        </div>
    ),
}));

function item(name: string, src: string | null = `blob:${name}`): ImageViewerGroup["items"][number] {
    return {
        mxEvent: new MatrixEvent({
            type: EventType.RoomMessage,
            event_id: `$${name}`,
            content: { msgtype: "m.image", body: name, info: { w: 10, h: 20 } },
        }),
        mediaEventHelper: {
            sourceUrl: { value: Promise.resolve(src) },
            media: { isEncrypted: false },
        } as unknown as MediaEventHelper,
    };
}

describe("NavigableImageViewDialog", () => {
    const group = (index: number): ImageViewerGroup => ({
        items: [item("a.png"), item("b.png"), item("c.png")],
        index,
    });

    it("opens on the image that was clicked", async () => {
        render(<NavigableImageViewDialog group={group(1)} onFinished={vi.fn()} />);

        expect(await screen.findByTestId("viewer")).toHaveAttribute("data-name", "b.png");
    });

    it("flips through the images and offers only the possible directions", async () => {
        render(<NavigableImageViewDialog group={group(0)} onFinished={vi.fn()} />);

        expect(await screen.findByTestId("viewer")).toHaveAttribute("data-name", "a.png");
        expect(screen.queryByText("previous")).not.toBeInTheDocument();

        fireEvent.click(screen.getByText("next"));
        await waitFor(() => expect(screen.getByTestId("viewer")).toHaveAttribute("data-name", "b.png"));
        expect(screen.getByText("previous")).toBeInTheDocument();

        fireEvent.click(screen.getByText("next"));
        await waitFor(() => expect(screen.getByTestId("viewer")).toHaveAttribute("data-name", "c.png"));
        expect(screen.queryByText("next")).not.toBeInTheDocument();

        fireEvent.click(screen.getByText("previous"));
        await waitFor(() => expect(screen.getByTestId("viewer")).toHaveAttribute("data-name", "b.png"));
    });

    it("closes when the first image can not be loaded", async () => {
        const onFinished = vi.fn();
        render(
            <NavigableImageViewDialog
                group={{ items: [item("a.png", null), item("b.png")], index: 0 }}
                onFinished={onFinished}
            />,
        );

        await waitFor(() => expect(onFinished).toHaveBeenCalled());
        expect(screen.queryByTestId("viewer")).not.toBeInTheDocument();
    });
});
