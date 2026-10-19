// A text box with a list of suggestions fetched as the user types, used for picking places on the
// start page and taxa in the answer box. Arrow keys move through the list, Enter or a click picks a
// suggestion, Escape closes it. Enter with nothing highlighted is left to the page (e.g. to submit).
//
// options:
//   search(query)      async, returns the items to suggest
//   renderItem(item)   returns the DOM nodes to show in the item's row
//   onChoose(item)     called when the user picks an item
//   minLength, delay   characters needed and typing pause (ms) before searching
function attachSuggestions(input, list, { search, renderItem, onChoose, minLength = 2, delay = 250 }) {
    let items = []; // suggestions currently listed
    let itemsFor = ''; // the text they were searched for
    let active = -1; // highlighted with the arrow keys
    let timer, request = 0;

    input.setAttribute('role', 'combobox');
    input.setAttribute('aria-autocomplete', 'list');
    input.setAttribute('aria-expanded', 'false');
    input.setAttribute('aria-controls', list.id);
    input.setAttribute('autocomplete', 'off');
    list.setAttribute('role', 'listbox');
    list.classList.add('suggestions');

    function render() {
        list.replaceChildren(...items.map((item, index) => {
            const row = document.createElement('li');
            row.id = `${list.id}-option-${index}`;
            row.setAttribute('role', 'option');
            row.setAttribute('aria-selected', index === active ? 'true' : 'false');
            row.append(...renderItem(item));
            // mousedown rather than click, so it runs before the input loses focus
            row.addEventListener('mousedown', event => {
                event.preventDefault();
                choose(index);
            });
            return row;
        }));
        const open = items.length > 0 && document.activeElement === input && !input.disabled;
        list.hidden = !open;
        input.setAttribute('aria-expanded', open ? 'true' : 'false');
        if (active >= 0) input.setAttribute('aria-activedescendant', `${list.id}-option-${active}`);
        else input.removeAttribute('aria-activedescendant');
        if (active >= 0) list.children[active].scrollIntoView({ block: 'nearest' });
    }

    function close() {
        list.hidden = true;
        input.setAttribute('aria-expanded', 'false');
        input.removeAttribute('aria-activedescendant');
        active = -1;
    }

    function clear() {
        clearTimeout(timer);
        request++; // ignore any search still in flight
        items = [];
        itemsFor = '';
        close();
    }

    function choose(index) {
        const item = items[index];
        clear();
        onChoose(item);
    }

    input.addEventListener('input', () => {
        clearTimeout(timer);
        const query = input.value.trim();
        if (query.length < minLength) {
            items = [];
            render();
            return;
        }
        // Wait for a pause in typing, and ignore answers to queries that are no longer current
        timer = setTimeout(async () => {
            const current = ++request;
            try {
                const results = await search(query);
                if (current !== request) return;
                items = results;
                itemsFor = query;
                active = -1;
                render();
            } catch (err) {
                console.warn('Could not load suggestions:', err);
            }
        }, delay);
    });

    input.addEventListener('keydown', event => {
        const open = !list.hidden;
        if (event.key === 'ArrowDown' && open) {
            active = (active + 1) % items.length;
            render();
            event.preventDefault();
        } else if (event.key === 'ArrowUp' && open) {
            active = (active - 1 + items.length) % items.length;
            render();
            event.preventDefault();
        } else if (event.key === 'Escape' && open) {
            close();
            event.preventDefault();
        } else if (event.key === 'Enter' && open && active >= 0) {
            choose(active);
            event.preventDefault();
        }
    });

    input.addEventListener('blur', close);
    input.addEventListener('focus', () => {
        if (items.length && itemsFor === input.value.trim()) render();
    });

    return {
        // The top suggestion shown for exactly this text, if any
        topFor(text) {
            return items.length && itemsFor === text ? items[0] : null;
        },
        clear
    };
}
