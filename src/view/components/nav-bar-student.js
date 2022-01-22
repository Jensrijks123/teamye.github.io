import { LitElement, html, css } from "lit";

export class navbarStudent extends LitElement {

    static styles = css`
    .navbar {
        min-height:50px;
        background-color: white;
        padding: 0.8em;
        border-bottom: 0.1rem solid gainsboro;
        box-shadow: rgba(0, 0, 0, 0.05) 0px 5px 15px;
    }
    
    .container-navbar {
        display: flex;
        place-content: space-between;
    }
    
    .hu-logo {
        margin-left: 5%;
    }
    `;

    constructor() {
        super();
    }

    render() {
        return html`
        <div class="navbar">
            <div class="container-navbar">
                <img class="hu-logo" src="./src/images/HU-Logo.jpg" alt="HU logo">
                <login-button></login-button>
            </div>
        </div>
        `;
    }
}

customElements.define('nav-barstudent', navbarStudent);