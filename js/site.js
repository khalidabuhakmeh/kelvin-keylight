function change(button) {
    const parent = button.parentElement;
    const buttons = parent.querySelectorAll('button[aria-selected]');
    buttons.forEach(btn => btn.removeAttribute('aria-selected'));
    const display = document.getElementById('display');

    document.body.style.backgroundColor = window.getComputedStyle(button).backgroundColor;
    button.setAttribute("aria-selected", "true");
    display.textContent = button.title;
}

function init() {
    const buttons = document.querySelectorAll('#presets button');
    buttons.forEach(button => {
        button.addEventListener('click', () => change(button));
        if (button.hasAttribute('aria-selected')) {
            button.click();
        }
    });
    document.getElementById('colorPicker').addEventListener('change', function (event) {
        document.body.style.backgroundColor = event.target.value;
        const buttons = document.querySelectorAll('#presets button[aria-selected]');
        buttons.forEach(btn => btn.removeAttribute('aria-selected'));
        const display = document.getElementById('display');
        display.textContent = event.target.value;
    });
}

document.addEventListener('DOMContentLoaded', init);