import { LitElement, html, css } from "lit";
import { configureStore } from "@reduxjs/toolkit";
import  reducer  from "../../redux/reducer";
import  login  from '../../redux/actions.login';

export class signOut extends LitElement {

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

        .loguit-button {
            padding: 0.7rem 1.4rem;
            font-weight: bold;
            font-size: 0.9rem;
            color: rgb(41, 41, 41);
            border: solid;
            border-width: 2px;
            box-shadow: rgba(0, 0, 0, 0.15) 0px 5px 15px;
            outline: none;
            cursor: pointer;
            background: white;
            margin-right: 2rem;
        }
        
        
        .loguit-button:hover {
            background-color: #45b3eb;
        }
        
        .loguit-button:active {
            background-color: #39ace7;
            -moz-transform: scale(0.95);
            -webkit-transform: scale(0.95);
            -o-transform: scale(0.95);
            -ms-transform: scale(0.95);
            transform: scale(0.95);
        }

        .loguit-button  {
            background-color: rgb(0, 154, 209);
            border: none;
            color: white;
            padding: 13px 31px;
            text-align: center;
            -webkit-box-shadow: 0 10px 30px 0 rgba(95,186,233,0.4);
            box-shadow: 0 10px 30px 0 rgba(95,186,233,0.4);
            -webkit-border-radius: 5px 5px 5px 5px;
            border-radius: 5px 5px 5px 5px;
            -webkit-transition: all 0.3s ease-in-out;
            -moz-transition: all 0.3s ease-in-out;
            -ms-transition: all 0.3s ease-in-out;
            -o-transition: all 0.3s ease-in-out;
            transition: all 0.3s ease-in-out;
        }
    `;

    constructor() {
        super();
    }

    render() {
        return html`
        <button class="loguit-button" @click="${this._signOut}">Loguit</button>
        `;
    }

    _signOut() {
        const store = configureStore({
            reducer: reducer
        })

        store.dispatch(login.loggedOut());
        
        if(store.getState().login === false) {
            window.location.href = "http://localhost:8000/student"
        }
    }
}

customElements.define('signout-button', signOut);