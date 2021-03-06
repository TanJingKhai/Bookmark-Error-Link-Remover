browser.browserAction.onClicked.addListener(() => {
    browser.tabs.create({url: "/index.html"});
});

async function findDead(error, progress) {
    const ignoredScheme = /^(place|about|javascript|data)\:/i;

    let found = 0;
    let running = 0;
    function work(queue, error, progress) {
        if (running > 30) {
            setTimeout(work, 500, queue, error, progress);
            return;
        }
        if (queue.length == 0) {
            return;
        }

        running++;
        const bookmark = queue.shift();
        // Can't use HEAD request, because a ton of websites return a 405 error.
        // For example amazon.com or medium.com.
        fetch(bookmark.url).then(response => {
            running--;

            if (!response.ok) {
                error(bookmark, response.status);
                return;
            }

            found++;
            progress(bookmark.id, found);
        }).catch(exception => {
            running--;
            error(bookmark, exception.toString())
        });

        work(queue, error, progress);
    }

    browser.bookmarks.search({}).then(bookmarks => {
        let queue = [];
        for (const bookmark of bookmarks) {
            const url = bookmark.url;
            if (!url || ignoredScheme.test(url)) {
                continue;
            }

            queue.push(bookmark);
        }

        work(queue, error, progress);
    });
}

function onMessage(message, sender, sendResponse) {
    if (message.type == "find_dead") {
        findDead((bookmark, error) => {
            browser.tabs.sendMessage(sender.tab.id, {type: "dead", bookmark, error});
        }, (id, found) => {
            browser.tabs.sendMessage(sender.tab.id, {type: "alive", id, found});
        });
    } else if (message.type == "remove") {
        browser.bookmarks.remove(message.id);
    }

    return true;
}

browser.runtime.onMessage.addListener(onMessage);
