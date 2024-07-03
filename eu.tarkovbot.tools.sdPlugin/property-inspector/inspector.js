/// <reference path="../libs/js/property-inspector.js" />
/// <reference path="../libs/js/utils.js" />

$PI.onConnected((jsn) => {
    const form = document.querySelector('#property-inspector');
    const { actionInfo } = jsn;
    const { payload } = actionInfo;
    const { settings } = payload;

    // Function to set form value based on settings
    const setFormValue = (settings, form) => {
        for (let key in settings) {
            if (form.elements[key]) {
                const element = form.elements[key];
                if (element.tagName === 'SELECT') {
                    element.value = settings[key];
                } else if (element.type === 'checkbox') {
                    element.checked = settings[key];
                } else {
                    element.value = settings[key];
                }
            }
        }
    };

    // Function to get form value
    const getFormValue = (form) => {
        const value = {};
        for (let element of form.elements) {
            if (element.name) {
                if (element.type === 'checkbox') {
                    value[element.name] = element.checked ? true : false;
                } else if (element.type === 'radio') {
                    if (element.checked) {
                        value[element.name] = element.value;
                    }
                } else {
                    value[element.name] = element.value;
                }
            }
        }
        return value;
    };


    // Set initial form values
    setFormValue(settings, form);

    // Event listener for changes in the form inputs
    const inputs = form.querySelectorAll('.sdpi-item-value');
    inputs.forEach(input => {
        input.addEventListener('change', Utils.debounce(150, (event) => {
            const value = getFormValue(form);
            $PI.setSettings(value);
        }));
    });

    // Event listener for changes in the select element
    const select = form.querySelector('.sdpi-item-value.select');
    select.addEventListener('change', Utils.debounce(150, (event) => {
        const value = getFormValue(form);
        $PI.setSettings(value);
    }));
});



$PI.onDidReceiveGlobalSettings(({ payload }) => {
    console.log('onDidReceiveGlobalSettings', payload);
})

/**
 * Provide window level functions to use in the external window
 * (this can be removed if the external window is not used)
 */
window.sendToInspector = (data) => {
    console.log(data);
};

document.querySelector('#open-external').addEventListener('click', () => {
    window.open('../../../external.html');
});


/** 
 * TABS
 * ----
 * 
 * This will make the tabs interactive:
 * - clicking on a tab will make it active
 * - clicking on a tab will show the corresponding content
 * - clicking on a tab will hide the content of all other tabs
 * - a tab must have the class "tab"
 * - a tab must have a data-target attribute that points to the id of the content
 * - the content must have the class "tab-content"
 * - the content must have an id that matches the data-target attribute of the tab
 * 
 *  <div class="tab selected" data-target="#tab1" title="Show some inputs">Inputs</div>
 *  <div class="tab" data-target="#tab2" title="Here's some text-areas">Text</div>
 * a complete tab-example can be found in the index.html
   <div type="tabs" class="sdpi-item">
      <div class="sdpi-item-label empty"></div>
      <div class="tabs">
        <div class="tab selected" data-target="#tab1" title="Show some inputs">Inputs</div>
        <div class="tab" data-target="#tab2" title="Here's some text-areas">Text</div>
      </div>
    </div>
    <hr class="tab-separator" />
 * You can use the code below to activate the tabs (`activateTabs` and `clickTab` are required)
 */

function activateTabs(activeTab) {
    const allTabs = Array.from(document.querySelectorAll('.tab'));
    let activeTabEl = null;
    allTabs.forEach((el, i) => {
        el.onclick = () => clickTab(el);
        if (el.dataset?.target === activeTab) {
            activeTabEl = el;
        }
    });
    if (activeTabEl) {
        clickTab(activeTabEl);
    } else if (allTabs.length) {
        clickTab(allTabs[0]);
    }
}

function clickTab(clickedTab) {
    const allTabs = Array.from(document.querySelectorAll('.tab'));
    allTabs.forEach((el, i) => el.classList.remove('selected'));
    clickedTab.classList.add('selected');
    activeTab = clickedTab.dataset?.target;
    allTabs.forEach((el, i) => {
        if (el.dataset.target) {
            const t = document.querySelector(el.dataset.target);
            if (t) {
                t.style.display = el == clickedTab ? 'block' : 'none';
            }
        }
    });
}

activateTabs();
