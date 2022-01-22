import { LitElement, html, css } from "lit";
import { configureStore } from "@reduxjs/toolkit";
import  reducer  from "../../redux/reducer";
import  login  from '../../redux/actions.login';

export class loginButton extends LitElement {
    
    static styles = css`
        .login-button {
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
        
        
        .login-button:hover {
            background-color: #45b3eb;
        }
        
        .login-button:active {
            background-color: #39ace7;
            -moz-transform: scale(0.95);
            -webkit-transform: scale(0.95);
            -o-transform: scale(0.95);
            -ms-transform: scale(0.95);
            transform: scale(0.95);
        }

        .login-button  {
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

        #modal {
            --color-primary: #009579;
            --color-primary-dark: #007f67;
            --color-secondary: #252c6a;
            --color-error: #cc3333;
            --color-succes: #4bb544;
            --bord-radius: 15px;

            display: none; 
            position: fixed; 
            z-index: 3; 

            padding-top: 100px; 
            left: 0;
            top: 0;
            width: 100%; 
            height: 100%; 
            overflow: auto; 
            background-color: rgb(0,0,0); 
            background-color: rgba(0,0,0,0.4); 
        }
        
        .modal-content {
            background-color: #fefefe;
            margin: auto;
            border: 1px solid #888;
            width: fit-content;
            max-width: fit-content;
            border-radius: var(--bord-radius);
            animation: appear 201ms ease-in 1;
            display:flex;
            align-items: center;
            justify-content: center;

        }

        @keyframes appear {
            0%{
                opacity: 0;
                transform: translateY(-10px);
            }
        }

        .container {
            width: 400px;
            max-width: 400px;
            padding: 2rem;
            box-shadow: 0 0 40px rgba(0,0, 0, 0.2);
            border-radius: var(--bord-radius);
            background: #ffffff;
        }
        
        .container, .formInput, .formButton {
            font: 500 1rem 'Roboto', sans-serif;
        }
        
        
        .form > *:first-child {
            margin-top: 0;
        }
        
        .form > *:last-child {
            margin-bottom: 0;
        }

        .login-flex-container {
            display:flex;
            justify-content: space-between;
            flex-wrap: wrap;
        }

        .formTitle {
            font-size:1.6em;
        }
        
        .close {
            width: 30px;
            font-size: 20px;
            color: #c0c5cb;
            background-color: transparent;
            border: none;
        }

        .close:hover,
        .close:focus {
            color: #000;
            text-decoration: none;
            cursor: pointer;
        }
        
        .form__message {
            text-align: center;
            margin-bottom: 1rem;
        }
        
        .form__message-error {
            color: var(--color-error);
        }
        
        .form__message-success {
            color: var(--color-succes);
        }
        
        .formInputGroup {
            margin-bottom: 1rem;
        }
        
        .formInput {
            display: block;
            width: 100%;
            padding: 0.75rem;
            box-sizing: border-box;
            border-radius: var(--bord-radius);
            border: 1px solid #dddddd;
            outline: none;
            background: #eeeeee;
            transition: background 0.2s, border-color 0.2s;
        }
        
        .formInput:focus {
            border-color: var(--color-primary);
            background: #ffffff;
        }
        
        .formInputError {
            color: var(--color-error);
            border-color: var(--color-error);
        }
        
        .formInputErrorMessage {
            margin-top: 0.5rem;
            font-size: 0.85rem;
            color: var(--color-error);
        }

        .formButton {
            width: 100%;
            padding: 1rem 2rem;
            font-weight: bold;
            font-size: 1.1rem;
            color: #ffffff;
            border: none;
            border-radius: var(--bord-radius);
            outline: none;
            cursor: pointer;
            text-shadow:
            -1px -1px 0 #000,  
            1px -1px 0 #000,
            -1px 1px 0 #000,
            1px 1px 0 #000;
            background: #009ad1;;
            margin-bottom: 2%;
        }
        
        .formButton:hover {
            background: #0281a1;
        }
        
        .formButton:active {
            transform: scale(0.98);
        }
        
        .formText {
            text-align: center;
        }
        
        .formLink {
            color: var(--color-secondary);
            text-decoration: none;
            cursor: pointer;
        }
        
        .formLink:hover {
            text-decoration: underline;
        }

    `;

    

    constructor() {
        super();    
    
    }

    render() {
        return html`
        <section id = "modal-section" @click="${this._closeModalOutside}">

            <button class="login-button" @click="${this._twoFunctions}" ">Log In</button>

            <div id="modal" role="alertdialog">
                <div class="modal-content" role="alertdialog">
                    
                    <div class="modal-body" role="alertdialog">
                    
                        <div class="form container" id="login"name="login">

                            <div class="login-flex-container">
                                <p class="empty">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</p>
                                <h2 tabindex="0" class="formTitle">Log In</h2>
                                <button class="close" id="close-button" @click="${this._hideModal}" aria-label="Close knop" aria-labelledby="escape knop">✖</button>
                            </div>

                            <div class="form__message form__message-error"></div>

                            <div class="formInputGroup">
                                <input aria-label="Vul hier je email in" name="email" id="userEmail" type="email" class="formInput" autofocus placeholder="Email" value="cursus@cursus.hu.nl" required>
                                <div class="formInputErrorMessage"></div>
                            </div>

                            <div class="formInputGroup">
                                <input aria-label="Vul hier je wachtwoord in" name="password" id="password" type="password" class="formInput" placeholder="Password" autocomplete="on" value="cursus"required>
                                <div class="formInputErrorMessage"></div>
                            </div>

                            <button id="loginFormSubmit" class="formButton" type="submit" @click="${this._checkForLogin}">Login</button>

                            <p class="formText">
                                <a id="showMeAllCountriesTest" href="/" class="formLink">Wachtwoord vergeten</a>
                            </p>

                        </form>
                        
                    </div>
                </div
            </div>
        </section>
        `;
    }




    _twoFunctions() {
        this._focusAccessable();
        this._showModal();
    }

    _focusAccessable() {
        const focusableElements = 'h2, [href], input, select, textarea, button, [tabindex]:not([tabindex="-1"])';
        const modal = this.shadowRoot.querySelector('#modal');

        const firstFocusableElement = modal.querySelectorAll(focusableElements)[0]; 
        const focusableContent = modal.querySelectorAll(focusableElements);
        const lastFocusableElement = focusableContent[focusableContent.length - 1]; 

        let shadow = this.shadowRoot;

        document.addEventListener('keydown', function(e) {
            let isTabPressed = e.key === 'Tab' || e.keyCode === 9;

            if (!isTabPressed) {
                return;
            }

            if (e.shiftKey ) { 
                if (shadow.activeElement === firstFocusableElement) {
                    lastFocusableElement.focus();
                    e.preventDefault();
                }
            } else { 
                if (shadow.activeElement === lastFocusableElement) { 
                    firstFocusableElement.focus();
                    e.preventDefault();
                }
            }
        });
    }


    _checkForLogin() {
        const store = configureStore({
            reducer: reducer
          })
        
        var emailInput = this.shadowRoot.querySelector('#userEmail').value;
        var wachtwoordInput = this.shadowRoot.querySelector('#password').value;
        const messageElement = this.shadowRoot.querySelector(".form__message");
        // check is user is a cursuscoordinator
        if (emailInput == "cursus@cursus.hu.nl" && wachtwoordInput == "cursus") {
            store.dispatch(login.loggedIn());
            if(store.getState().login === true) {
                messageElement.textContent = "";
                messageElement.classList.remove("form__message--success", "form__message--error");
                window.location.href = "http://localhost:8000/"
                return console.log("INGELOGD, cursuscoordinator");
            }
        }

        // check is user is an examencoordinator
        if (emailInput == "examen@examen.hu.nl" && wachtwoordInput == "examen") {
            store.dispatch(login.loggedIn());
            if(store.getState().login === true) {
                messageElement.textContent = "";
                messageElement.classList.remove("form__message--success", "form__message--error");
                window.location.href = "http://localhost:8000/"
                return console.log("INGELOGD, examencoordinator");
            }
        }

        messageElement.textContent = "Verkeerde Email/Wachtwoord Combinatie";
        messageElement.classList.remove("form__message--success", "form__message--error");
        messageElement.classList.add(`form__message--error`);
    }


    _showModal() {
        var modalDiv = this.shadowRoot.querySelector('#modal')
        modalDiv.style.display = 'block';
    }

    _hideModal() {
        var modalDiv = this.shadowRoot.querySelector('#modal')
        modalDiv.style.display = 'none';
    }

    _closeModalOutside(event) {
        var modalDiv = this.shadowRoot.querySelector('#modal')
        if (event.target == modalDiv) {
            modalDiv.style.display = "none";
        }
    }
}

customElements.define('login-button', loginButton);