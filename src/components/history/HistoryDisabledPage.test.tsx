import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import HistoryPage from "../../../app/history/page";

describe("history disabled page", () => {
  it("shows a friendly disabled persistence message", () => {
    const html = renderToStaticMarkup(<HistoryPage />);

    expect(html).toContain("Persistent scan history is not enabled");
    expect(html).toContain("real-time Remote Binance scans only");
  });
});
