"use client";

import type { ComponentProps } from "react";

export function ConfirmForm({
  message,
  ...props
}: ComponentProps<"form"> & { message: string }) {
  return (
    <form
      {...props}
      onSubmit={(event) => {
        if (!window.confirm(message)) {
          event.preventDefault();
          return;
        }
        props.onSubmit?.(event);
      }}
    />
  );
}
