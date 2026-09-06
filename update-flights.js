const fs = require('fs');
const { ApifyClient } = require('apify-client');

const client = new ApifyClient({
    token: process.env.APIFY_API_TOKEN
});

async function getFlights(direction) {

    console.log(`Fetching YHZ ${direction}...`);

    const input = {
        airports: ["YHZ"],
        direction: direction,
        wholeDay: false,
        includeStatus: true,
        combineCodeshares: true
    };

    const actorRun = await client
        .actor("apt_marble/airport-departures-arrivals-board-scraper")
        .call(input);

    const { items } = await client
        .dataset(actorRun.defaultDatasetId)
        .listItems();

    console.log(`Received ${items.length} ${direction}.`);

    return items.map(f => {

        let status = (f.status || "Scheduled")
            .replace(/_/g, " ")
            .toLowerCase()
            .replace(/\b\w/g, c => c.toUpperCase());

        return {
            carrier: f.airline || "—",
            flight: f.flightNumber || "—",

            location: f.counterpartCity
                ? `${f.counterpartCity} (${f.counterpartAirport || ""})`
                : (f.counterpartAirport || "—"),

            expected: f.scheduledTimeLocal || "—",

            actual:
                f.estimatedTimeLocal ||
                f.actualTimeLocal ||
                f.scheduledTimeLocal ||
                "—",

            gate: f.gate || "—",
            status: status,
            delayMinutes: f.delayMinutes ?? 0
        };
    });
}

async function run() {

    try {

        console.log("Starting YHZ flight-board update...");

        const departures = await getFlights("departures");
        const arrivals = await getFlights("arrivals");

        const flightData = {
            updated: new Date().toISOString(),
            airport: "YHZ",

            departures: departures.map(f => ({
                carrier: f.carrier,
                flight: f.flight,
                destination: f.location,
                expected: f.expected,
                actual: f.actual,
                gate: f.gate,
                status: f.status,
                delayMinutes: f.delayMinutes
            })),

            arrivals: arrivals.map(f => ({
                carrier: f.carrier,
                flight: f.flight,
                from: f.location,
                expected: f.expected,
                actual: f.actual,
                gate: f.gate,
                status: f.status,
                delayMinutes: f.delayMinutes
            }))
        };

        fs.writeFileSync(
            "flights.json",
            JSON.stringify(flightData, null, 2)
        );

        fs.writeFileSync(
            "last_updated.txt",
            new Date().toISOString()
        );

        console.log(
            `SUCCESS: ${departures.length} departures and ` +
            `${arrivals.length} arrivals saved.`
        );

    } catch (error) {

        console.error("YHZ flight update failed:");
        console.error(error);

        process.exit(1);
    }
}

run();
