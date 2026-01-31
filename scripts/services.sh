#!/bin/bash
# Polymarket Data Platform - Service Control Script

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
PID_DIR="$PROJECT_DIR/data/pids"
LOG_DIR="$PROJECT_DIR/data/logs"

mkdir -p "$PID_DIR" "$LOG_DIR"

start_service() {
    local name=$1
    local script=$2

    if [ -f "$PID_DIR/$name.pid" ]; then
        local pid=$(cat "$PID_DIR/$name.pid")
        if kill -0 "$pid" 2>/dev/null; then
            echo "[$name] Already running (PID $pid)"
            return
        fi
    fi

    cd "$PROJECT_DIR"
    node "$script" > "$LOG_DIR/$name.log" 2>&1 &
    local pid=$!
    echo $pid > "$PID_DIR/$name.pid"
    echo "[$name] Started (PID $pid)"
}

stop_service() {
    local name=$1

    if [ -f "$PID_DIR/$name.pid" ]; then
        local pid=$(cat "$PID_DIR/$name.pid")
        if kill -0 "$pid" 2>/dev/null; then
            kill "$pid" 2>/dev/null
            echo "[$name] Stopped (PID $pid)"
        else
            echo "[$name] Not running"
        fi
        rm -f "$PID_DIR/$name.pid"
    else
        echo "[$name] Not running"
    fi
}

status_service() {
    local name=$1

    if [ -f "$PID_DIR/$name.pid" ]; then
        local pid=$(cat "$PID_DIR/$name.pid")
        if kill -0 "$pid" 2>/dev/null; then
            echo "[$name] Running (PID $pid)"
        else
            echo "[$name] Dead (stale PID file)"
            rm -f "$PID_DIR/$name.pid"
        fi
    else
        echo "[$name] Stopped"
    fi
}

case "$1" in
    start)
        echo "=== Starting all services ==="
        start_service "polymarket" "src/collectors/polymarket.service.js"
        start_service "binance" "src/collectors/binance.service.js"
        start_service "yahoo" "src/collectors/yahoo.service.js"
        start_service "paper-trader" "src/paper/paper-trader.service.js"
        echo ""
        echo "Logs in: $LOG_DIR"
        echo "Use '$0 status' to check"
        ;;

    stop)
        echo "=== Stopping all services ==="
        stop_service "polymarket"
        stop_service "binance"
        stop_service "yahoo"
        stop_service "paper-trader"
        ;;

    restart)
        $0 stop
        sleep 2
        $0 start
        ;;

    status)
        echo "=== Service Status ==="
        status_service "polymarket"
        status_service "binance"
        status_service "yahoo"
        status_service "paper-trader"
        echo ""
        cd "$PROJECT_DIR" && node src/cli/index.js status 2>/dev/null
        ;;

    logs)
        local service=${2:-polymarket}
        if [ -f "$LOG_DIR/$service.log" ]; then
            tail -f "$LOG_DIR/$service.log"
        else
            echo "No log file for $service"
        fi
        ;;

    *)
        echo "Usage: $0 {start|stop|restart|status|logs [service]}"
        echo ""
        echo "Commands:"
        echo "  start   - Start all collectors and paper trader"
        echo "  stop    - Stop all services"
        echo "  restart - Restart all services"
        echo "  status  - Show service status and DB stats"
        echo "  logs    - Tail logs (default: polymarket)"
        echo ""
        echo "Examples:"
        echo "  $0 start"
        echo "  $0 logs binance"
        exit 1
        ;;
esac
