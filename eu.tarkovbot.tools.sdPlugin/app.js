const DestinationEnum = Object.freeze({ "HARDWARE_AND_SOFTWARE": 0, "HARDWARE_ONLY": 1, "SOFTWARE_ONLY": 2 });

let websocket = null;
let pluginUUID = null;
let intervalId = null;
let traderRestockData;
let traderRestockData_PVE;

const API_URLS = {
    TRADER_RESETS: "https://tarkovbot.eu/api/trader-resets/",
    PVE_TRADER_RESETS: "https://tarkovbot.eu/api/pve/trader-resets/",
    GOONS_LOCATION: "https://tarkovbot.eu/api/streamdeck/goonslocation",
};

const fetchData = (url, token = null) => {
    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("GET", url, true);
        if (token) xhr.setRequestHeader("AUTH-TOKEN", token);
        xhr.onreadystatechange = () => {
            if (xhr.readyState === 4) {
                if (xhr.status === 200) {
                    resolve(JSON.parse(xhr.responseText));
                } else {
                    reject(xhr.status);
                }
            }
        };
        xhr.send();
    });
};

const getTimeAgoString = (timeDifference) => {
    const seconds = Math.floor(timeDifference / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    return `${hours > 0 ? `${hours}h ` : ''}${minutes > 0 ? `${minutes % 60}m ` : ''}${seconds % 60}s`;
};

const updateTraderData = () => {
    fetchData(API_URLS.TRADER_RESETS)
        .then(response => traderRestockData = response.data.traders)
        .catch(console.error);
};

const updateTraderData_PVE = () => {
    fetchData(API_URLS.PVE_TRADER_RESETS)
        .then(response => traderRestockData_PVE = response.data.traders)
        .catch(console.error);
};

updateTraderData();
setInterval(updateTraderData, 5 * 60 * 1000);

updateTraderData_PVE();
setInterval(updateTraderData_PVE, 5 * 55 * 1000);


class Action {
    constructor(type) {
        this.type = type;
    }

    setTitle(context, title) {
        websocket.send(JSON.stringify({
            event: "setTitle",
            context,
            payload: {
                title,
                target: DestinationEnum.HARDWARE_AND_SOFTWARE,
                state: 2
            }
        }));
    }

    setImage(context, image) {
        websocket.send(JSON.stringify({
            event: "setImage",
            context,
            payload: {
                image,
                target: DestinationEnum.HARDWARE_AND_SOFTWARE,
                state: 2
            }
        }));
    }

    switchToProfile(context, profile) {
        websocket.send(JSON.stringify({
            event: "switchToProfile",
            context: context,
            device: pluginUUID,
            payload: {
                profile: profile
            }
        }));
    }
}

class GoonsTrackerAction extends Action {
    constructor() {
        super("eu.tarkovbot.tools.goonsgetlocation");
    }

    onKeyDown(context, settings) {
        if (settings?.token) {
            this.setTitle(context, "Loading");
            fetchData(API_URLS.GOONS_LOCATION, settings.token)
                .then(response => {
                    const source = settings.selectedGoonsSource;
                    const data = source === "PVE" ? response.pve : source === "PVP" ? response.pvp : response;
                    const location = data.location;
                    const timeAgo = getTimeAgoString(Date.now() - new Date(data.reported));
                    this.setTitle(context, `${location}\n${timeAgo}`);
                })
                .catch(status => {
                    this.setTitle(context, status === 401 ? "Invalid\nToken" : "Error");
                });
        } else {
            this.setTitle(context, "Invalid\nToken");
        }
    }

    onWillAppear(context) {
        this.setTitle(context, "Press to\nGet\nLocation");
    }
}

class TarkovTimeAction extends Action {
    constructor() {
        super("eu.tarkovbot.tools.tarkovtime");
    }

    onWillAppear(context) {
        this.setTitle(context, "Loading");

        const calculateTarkovTime = () => {
            const currentDateTime = new Date();
            const multiplier = 7;
            const tarkovTimeLeft = new Date(currentDateTime.getTime() * multiplier).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Europe/Moscow' });
            const tarkovTimeRight = new Date(currentDateTime.getTime() * multiplier - 43200000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Europe/Moscow' });

            this.setTitle(context, `${tarkovTimeLeft}\n${tarkovTimeRight}`);
        };

        calculateTarkovTime();
        if (intervalId !== null) clearInterval(intervalId);
        intervalId = setInterval(calculateTarkovTime, 2000);
    }
}

class TraderRestockAction extends Action {
    constructor() {
        super("eu.tarkovbot.tools.traderrestock");
        this.intervalIds = {};
    }

    updateTitleAndImage(context, restockData) {
        if (!restockData) {
            this.setTitle(context, "No Data");
            this.setImage(context, ``);
            return;
        }

        const resetTime = new Date(restockData.resetTime);
        const currentTime = new Date();
        const timeDifference = resetTime.getTime() - currentTime.getTime();

        if (timeDifference > 0) {
            const hours = String(Math.floor(timeDifference / (1000 * 60 * 60))).padStart(1, '0');
            const minutes = String(Math.floor((timeDifference % (1000 * 60 * 60)) / (1000 * 60))).padStart(2, '0');
            const seconds = String(Math.floor((timeDifference % (1000 * 60)) / 1000)).padStart(2, '0');
            this.setTitle(context, `\n\n\n${hours}:${minutes}:${seconds}`);
        } else {
            this.setTitle(context, `\n\n\nRestock`);
        }

        this.setImage(context, `assets/${restockData.name}.png`);
    }

    startUpdating(context, settings) {
        clearInterval(this.intervalIds[context]);
        this.intervalIds[context] = setInterval(() => {
            const trader = settings.selectedTrader;
            const pveMODE = settings.pve_traders_mode_check;
            const restockData = (pveMODE ? traderRestockData_PVE : traderRestockData).find(data => data.name === trader);

            this.updateTitleAndImage(context, restockData);
        }, 1000);
    }

    stopUpdating(context) {
        clearInterval(this.intervalIds[context]);
    }

    onWillAppear(context, settings) {
        this.setTitle(context, "\n\n\nLoading");
        if (settings.selectedTrader) {
            this.startUpdating(context, settings);
        } else {
            this.setImage(context, ``);
            this.setTitle(context, "Select\nTrader");
        }
    }

    onWillDisappear(context) {
        this.stopUpdating(context);
    }

    onDidReceiveSettings(context, settings) {
        this.setTitle(context, "\n\n\nLoading");
        if (settings.selectedTrader) {
            this.stopUpdating(context);
            this.startUpdating(context, settings);
        } else {
            this.stopUpdating(context);
            this.setImage(context, ``);
            this.setTitle(context, "Select\nTrader");
        }
    }
}

class MapInfoAction extends Action {
    constructor() {
        super("eu.tarkovbot.tools.mapinfo");
    }

    onKeyUp(context, settings) {
        this.switchToProfile(context, "Map Info XL");
    }       

    onWillAppear(context) {
        this.setTitle(context, "Switch\nProfile");
    }
}



const actions = {
    "eu.tarkovbot.tools.goonsgetlocation": new GoonsTrackerAction(),
    "eu.tarkovbot.tools.tarkovtime": new TarkovTimeAction(),
    "eu.tarkovbot.tools.traderrestock": new TraderRestockAction(),
    "eu.tarkovbot.tools.mapinfo": new MapInfoAction()
};

const connectElgatoStreamDeckSocket = (inPort, inPluginUUID, inRegisterEvent) => {
    pluginUUID = inPluginUUID;
    websocket = new WebSocket(`ws://127.0.0.1:${inPort}`);

    websocket.onopen = () => {
        websocket.send(JSON.stringify({
            event: inRegisterEvent,
            uuid: pluginUUID
        }));
    };

    websocket.onmessage = (evt) => {
        const jsonObj = JSON.parse(evt.data);
        const { event, action, context, payload } = jsonObj;

        switch (event) {
            case "keyDown":
                actions[action]?.onKeyDown(context, payload.settings);
                break;
            case "keyUp":
                actions[action]?.onKeyUp(context, payload.settings);
                break;
            case "willAppear":
                actions[action]?.onWillAppear(context, payload.settings);
                break;
            case "didReceiveSettings":
                actions[action]?.onDidReceiveSettings(context, payload.settings);
                break;
            case "willDisappear":
                actions[action]?.onWillDisappear(context, payload.settings);
                break;
        }
    };

    websocket.onclose = () => { };
};

const handleKeyDown = (action, context, payload) => {
    const { settings, coordinates, userDesiredState } = payload;
    actions[action]?.onKeyDown(context, settings, coordinates, userDesiredState);
};

const handleKeyUp = (action, context, payload) => {
    const { settings, coordinates, userDesiredState } = payload;
    actions[action]?.onKeyUp(context, settings, coordinates, userDesiredState);
};

const handleWillAppear = (action, context, payload) => {
    const { settings, coordinates } = payload;
    actions[action]?.onWillAppear(context, settings, coordinates);
};

const handleDidReceiveSettings = (action, context, payload) => {
    const { settings, coordinates } = payload;
    actions[action]?.onDidReceiveSettings(context, settings, coordinates);
};

const handleWillDisappear = (action, context, payload) => {
    const { settings, coordinates } = payload;
    actions[action]?.onWillDisappear(context, settings, coordinates);
};
