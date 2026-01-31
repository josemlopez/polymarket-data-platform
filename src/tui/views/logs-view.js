import blessed from "blessed";

const formatTimestamp = (timestamp) => {
  if (!timestamp) {
    return "—";
  }
  const date = new Date(timestamp);
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  const ss = String(date.getSeconds()).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
};

export const getCollectorLogs = (db, limit = 500) => {
  try {
    if (!db) {
      return [];
    }
    const rows = db
      .prepare(
        `SELECT timestamp, level, collector_name, message
         FROM collector_logs
         ORDER BY timestamp DESC
         LIMIT ?`,
      )
      .all(limit);

    return rows.map((row) => {
      const time = formatTimestamp(row.timestamp);
      const level = row.level ?? "INFO";
      const collector = row.collector_name ?? "system";
      const message = row.message ?? "";
      return `[${time}] ${level} ${collector} - ${message}`;
    });
  } catch (error) {
    return [];
  }
};

export class LogsView {
  constructor({ screen, onExit }) {
    this.screen = screen;
    this.onExit = onExit;
    this.box = blessed.box({
      parent: screen,
      top: 0,
      left: 0,
      width: "100%",
      height: "100%",
      label: " Logs [Esc/q to return] ",
      scrollable: true,
      alwaysScroll: true,
      keys: true,
      vi: true,
      mouse: true,
      scrollbar: {
        ch: "█",
        track: { bg: "gray" },
        style: { bg: "cyan" },
      },
      style: {
        fg: "white",
        border: { fg: "white" },
      },
      border: { type: "line" },
    });

    this.box.hide();

    this.box.key(["escape", "q"], () => {
      if (this.onExit) {
        this.onExit();
      }
    });
  }

  setLogs(lines) {
    if (!lines || lines.length === 0) {
      this.box.setContent("No logs yet");
      return;
    }
    this.box.setContent(lines.join("\n"));
  }

  show() {
    this.box.show();
    this.box.focus();
  }

  hide() {
    this.box.hide();
  }
}
