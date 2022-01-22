import { LitElement, html, css } from "lit";

export class footer extends LitElement {

    static styles = css`

    .container-footer {
        font-size: 0.8em;
        text-align: right;
        min-height:50px;
        background:rgb(51,51,51);
        color: white;
        padding: 1em 5em 1em 1em;
        margin: 0;
    `;

    constructor() {
        super();
    }

    render() {
        return html`
        <div class="footer-section">
            <div class="container-footer">
                <p>10.51.1797 | 08 december 2021 | © Hogeschool Utrecht</p>
            </div>
        </div>
        `;
    }
}

customElements.define('footer-component', footer);