const fs = require('fs');
const { ApifyClient } = require('apify-client');

async function run() {

    const client = new ApifyClient({
        token: process.env.APIFY_API_TOKEN
    });

    try {

        console.log("Starting live YHZ departures update...");

        const input = {
            airports: ["YHZ"],
            direction: "departures",
            wholeDay: false,
            includeStatus: true,
            combineCodeshares: true
        };

        const actorRun = await client
            .actor("apt_marble/airport-departures-arrivals-board-scraper")
            .call(input);

        console.log("Apify run completed. Fetching flight data...");

        const { items } = await client
            .dataset(actorRun.defaultDatasetId)
            .listItems();

        console.log(`Received ${items.length} YHZ departure records.`);

        if (!items || items.length === 0) {
            throw new Error("Apify returned no YHZ departure flights.");
        }

        const departures = items.map(f => {

            let status = f.status || "Scheduled";

            status = status
                .replace(/_/g, " ")
                .toLowerCase()
                .replace(/\b\w/g, c => c.toUpperCase());

            return {
                carrier: f.airline || "—",
                flight: f.flightNumber || "—",
                destination: f.counterpartCity
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

                delayMinutes:
                    f.delayMinutes ?? 0
            };
        });

        const flightData = {
            updated: new Date().toISOString(),
            airport: "YHZ",
            departures: departures
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
            `SUCCESS: flights.json updated with ${departures.length} live YHZ departures.`
        );

    } catch (error) {

        console.error("YHZ flight update failed:");
        console.error(error);

        process.exit(1);
    }
}

run();
