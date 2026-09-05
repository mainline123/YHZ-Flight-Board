const fs = require('fs');
const { ApifyClient } = require('apify-client');

async function run() {
    // Securely uses the token from GitHub Actions Secrets
    const client = new ApifyClient({
        token: process.env.APIFY_API_TOKEN
    });

    try {
        console.log("Triggering Apify flight tracker for YHZ...");
        
        const run = await client.actor("syntellect_ai/flight-tracker-actor").call({
            airport: "YHZ",
            limit: 30
        });

        console.log("Fetching dataset items from Apify...");
        const { items } = await client.dataset(run.defaultDatasetId).listItems();

        if (items && items.length > 0) {
            let flightData = items[0];
            
            if (!flightData.arrivals || !flightData.departures) {
                flightData = {
                    arrivals: items.filter(i => i.type === 'arrival' || i.from),
                    departures: items.filter(i => i.type === 'departure' || i.destination)
                };
            }

            fs.writeFileSync('flights.json', JSON.stringify(flightData, null, 2));
            fs.writeFileSync('last_updated.txt', new Date().toISOString());
            console.log("Successfully updated flights.json with live YHZ data!");
        } else {
            console.log("Apify ran successfully, but returned no items.");
            process.exit(1);
        }
    } catch (error) {
        console.error("Error running Apify integration:", error);
        process.exit(1);
    }
}

run();
