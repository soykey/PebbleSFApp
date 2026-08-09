# SF Live for Pebble Round 2

A lightweight SUPER FORMULA live timing watch app for the Pebble Round 2.

SF Live receives timing data from the SUPER FORMULA RaceNow WebSocket through PebbleKit JS and displays the current classification on the watch.

> [!IMPORTANT]
> This is an unofficial fan-made project.  
> It is not affiliated with, endorsed by, or supported by SUPER FORMULA, JRP, Pebble, or Core Devices.

## Features

- Live SUPER FORMULA classification
- Support for the Pebble Round 2 circular display
- Five drivers displayed per page
- Smooth horizontal page transitions
- Current position
- Car number
- Driver name
- Gap to the leader
- Current and scheduled lap count
- Weather and track conditions
- Automatic WebSocket reconnection during active sessions
- Final classification retained after a session finishes
- Built-in demonstration data for emulator testing

## Screens

The primary timing screen contains:

- Session status
- Current page number
- Driver positions
- Car numbers
- Driver surnames
- Gaps to the leader
- Lap count
- Weather and track conditions
- Page indicator

Example:

```text
            SF LIVE
          FINAL • 1/5

 POS       DRIVER          GAP

  1  #14  FUKUZUMI       LEAD
  2  #1   IWASA          0.505
  3  #65  FRAGA          0.939
  4  #6   OHTA           4.808
  5  #16  NOJIRI         6.138

       LAP 51/51 • CLOUD / DRY
                 ● • • • •
```

## Controls

### Pebble Round 2

- **Up** — Previous page
- **Down** — Next page
- **Select** — Refresh data or reconnect
- **Back** — Exit the app

### Local emulator

The local Gabbro emulator can be controlled with the keyboard:

- **Up Arrow** — Up button
- **Down Arrow** — Down button
- **Right Arrow** — Select button
- **Left Arrow** — Back button

Click the emulator window before using the keyboard if it does not respond.

## Architecture

SF Live consists of two JavaScript environments.

```text
SUPER FORMULA RaceNow
          │
          │ WebSocket
          ▼
src/pkjs/index.js
Runs inside the Pebble mobile app
          │
          │ AppMessage
          ▼
src/embeddedjs/main.js
Runs directly on the Pebble watch
```

### Watch application

`src/embeddedjs/main.js` runs on the Pebble watch and handles:

- Poco graphics rendering
- Round display layout
- Button input
- Page transitions
- AppMessage reception
- Demonstration data

### Phone application

`src/pkjs/index.js` runs inside the Pebble mobile app and handles:

- RaceNow WebSocket connection
- JSON message parsing
- Session information
- Weather information
- Classification processing
- Gap calculation
- Automatic reconnection
- AppMessage communication

## RaceNow data

The phone-side application connects to:

```text
ws://superformula.racelive.jp:6001/get
```

The following RaceNow message types are currently handled:

- `S` — Session information and session bests
- `T` — Timing or informational message
- `W` — Weather and track condition
- `0` — Full classification and timing data

The classification is derived from the order of the entries in the `rows` array.

### Gap calculation

During a completed session, the RaceNow fields for precomputed gaps may be empty.

For drivers on the same lap, SF Live calculates the gap using:

```text
Driver total time - Leader total time
```

For lapped drivers, SF Live displays the lap difference instead:

```text
1 LAP
2 LAPS
24 LAPS
```

## Final-session behavior

A completed session may provide one initial snapshot and then stop sending updates.

SF Live treats this as normal behavior when:

- The session description is `FINAL`
- Valid classification data has already been received

The stale-connection watchdog is disabled in that state, allowing the final classification to remain visible without entering a reconnection loop.

If a connection closes during a live session, the app attempts to reconnect automatically.

## Project structure

```text
PebbleSFApp/
├── package.json
├── wscript
├── README.md
└── src/
    ├── c/
    │   └── mdbl.c
    ├── embeddedjs/
    │   ├── main.js
    │   └── manifest.json
    └── pkjs/
        └── index.js
```

## Requirements

- Pebble Tool 5.0.38 or later
- Pebble SDK 4.17 or later
- Pebble Round 2 / Gabbro
- Node.js and npm
- Python 3.13 recommended
- Build tools for the host Linux environment
- WSL2 when developing on Windows

## Installing the SDK on Ubuntu or WSL2

Install the required system packages:

```bash
sudo apt update

sudo apt install -y \
  build-essential \
  python3-pip \
  python3-venv \
  nodejs \
  npm \
  libsdl1.2debian \
  libfdt1 \
  libpixman-1-0 \
  zlib1g-dev \
  git \
  curl \
  unzip
```

Install `uv`:

```bash
curl -LsSf https://astral.sh/uv/install.sh | sh
source ~/.bashrc
```

Install Python 3.13 and Pebble Tool:

```bash
uv python install 3.13
uv tool install pebble-tool --python 3.13
uv tool update-shell
source ~/.bashrc
```

Install the current Pebble SDK:

```bash
pebble sdk install 4.17
```

Verify the installation:

```bash
pebble --version
pebble sdk list
```

## Building

Clone the repository:

```bash
git clone https://github.com/soykey/PebbleSFApp.git
cd PebbleSFApp
```

Build the application:

```bash
pebble build
```

The resulting application bundle will be created in the `build` directory:

```text
build/PebbleSFApp.pbw
```

The exact PBW filename may vary depending on the local project name.

## Running in the Gabbro emulator

Build and install the application:

```bash
pebble build
pebble install --emulator gabbro
```

The commands can also be combined:

```bash
pebble build && pebble install --emulator gabbro
```

The watch-side application starts with demonstration data, so the user interface and page transitions can be tested without a physical watch.

## Debugging

Create a debug build:

```bash
rm -rf build
pebble build --debug
pebble install --emulator gabbro
```

View emulator logs:

```bash
pebble logs --emulator gabbro
```

Useful messages to look for include:

```text
Exception loading main
ReferenceError
SyntaxError
RaceNow socket error
RaceNow disconnected
send failed
```

## Installing on a physical watch

Enable Developer Connection in the Pebble mobile app and note the displayed IP address.

Build and install the application:

```bash
pebble build
pebble install --phone PHONE_IP
```

Example:

```bash
pebble install --phone 192.168.1.25
```

View logs from the physical watch:

```bash
pebble logs --phone 192.168.1.25
```

The computer and phone should normally be connected to the same local network.

## AppMessage keys

The application uses the following message keys:

```text
COMMAND
PAGE
STATUS
UPDATED
LAPS
WEATHER
PAGE_INFO
ROWS
```

The phone sends only the five drivers required for the currently selected page. This avoids sending the complete classification to the watch in a single AppMessage.

A packed page resembles:

```text
1|14|FUKUZUMI|LEAD
2|1|IWASA|0.505
3|65|FRAGA|0.939
4|6|OHTA|4.808
5|16|NOJIRI|6.138
```

## Animation

Page transitions use a lightweight horizontal slide animation.

Current settings:

- Approximately 30 frames per second
- 180 ms duration
- 150 px travel distance
- Cubic ease-out
- Partial redraw of the classification area only

Animations are used only for manual page changes.

Live timing updates and manual refreshes are applied immediately without animation.

## Emulator limitations

The emulator is useful for testing:

- Layout
- Button input
- Page navigation
- Animation behavior
- JavaScript exceptions
- Memory usage
- Demonstration data

The emulator does not fully reproduce:

- Bluetooth latency
- Physical button feel
- Real display appearance
- Battery consumption
- Mobile operating system network restrictions
- Background behavior of PebbleKit JS

Final verification should therefore be performed on a physical Pebble Round 2.

## Network limitations

RaceNow currently uses an unencrypted WebSocket connection:

```text
ws://
```

Some mobile operating systems or Pebble app environments may reject unencrypted WebSocket connections.

If this occurs, an external relay may be required:

```text
RaceNow ws://
      │
      ▼
External relay server
      │
      │ wss://
      ▼
PebbleKit JS
```

The current version attempts a direct connection first.

## Known limitations

- RaceNow is not a documented public developer API.
- The message format or endpoint may change without notice.
- Driver names are shortened to fit the circular display.
- The app currently displays gaps to the leader rather than intervals to the car ahead.
- Live behavior cannot be fully verified outside an active race session.
- Background WebSocket behavior may vary between mobile operating systems.
- Final connection behavior may differ between the emulator and a physical watch.

## Development workflow

The recommended workflow is:

```text
Edit locally
    ↓
Build with the local Pebble SDK
    ↓
Test in the Gabbro emulator
    ↓
Commit and push to GitHub
    ↓
Pull into CloudPebble when needed
    ↓
Test on a physical watch
```

The local SDK project should be treated as the primary source of truth. CloudPebble is useful for quick browser-based testing, but it may not preserve every local SDK project file.

## Disclaimer

This project is intended for personal and experimental use.

SUPER FORMULA timing data remains the property of its respective owners. Users of this project are responsible for complying with any applicable terms of service, data usage restrictions, and local regulations.

## License

See [LICENSE](LICENSE) for details.