import { LitElement, html, css } from 'lit';

export class pageLoader extends LitElement {
    static styles = css`

    .loader-wrapper {
        width: 100%;
        height: 100%;
        position: fixed;
        z-index: 10;
        top: 0;
        left: 0;
        background-color: #242f3f;
        display:flex;
        justify-content: center;
        align-items: center;
    }
    
    .loader {
        display: inline-block;
        z-index: 10;
        width: 50px;
        height: 50px;
        position: relative;
        border: 4px solid #Fff;
        animation: loader 2s infinite ease;
      }
    
      .loader-inner {
        z-index: 10;
        vertical-align: top;
        display: inline-block;
        width: 100%;
        background-color: #Fff;
        animation: loader-inner 2s infinite ease-in;
      }
    
      .emptyP {
          color: #242f3f;
      }
      
      @keyframes loader {
        0% { transform: rotate(0deg);}
        25% { transform: rotate(180deg);}
        50% { transform: rotate(180deg);}
        75% { transform: rotate(360deg);}
        100% { transform: rotate(360deg);}
    }
    
    @keyframes loader-inner {
        0% { height: 0%;}
        25% { height: 0%;}
        50% { height: 100%;}
        75% { height: 100%;}
        100% { height: 0%;}
      }
    `;

    constructor() {
        super();
        window.onload=this.fadeOut;
    }


    fadeOut(){
        var fadeTarget = document.querySelector('page-loader').shadowRoot.querySelector('.loader-wrapper');
        var fadeEffect = setInterval(function () {
            if (!fadeTarget.style.opacity) {
                fadeTarget.style.opacity = 1;
            }
            if (fadeTarget.style.opacity > 0) {
                fadeTarget.style.opacity -= 0.1;
            } else {
                clearInterval(fadeEffect);
                fadeTarget.remove();
            }
        }, 20);
      } 

    render() {
        return html`
         <div class="loader-wrapper" id="loader-wrapper">
            <span class="loader"><span class="loader-inner"></span><p class="emptyP">.</p></span>
        </div>
        `;
    }
}

customElements.define('page-loader', pageLoader);
