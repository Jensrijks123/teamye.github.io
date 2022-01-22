import { LitElement, html, css } from "lit";

export class DropdownTab extends LitElement {


    static styles = css`
    :host{}

    select {
        font: 400 12px/1.3 sans-serif;
        -webkit-appearance: none;
        appearance: none;
        color: var(--baseFg);
        border: 1px solid var(--baseFg);
        line-height: 1;
        outline: 0;
        padding: 0.65em 2.5em 0.55em 0.75em;
        border-radius: var(--radius);
        background-color: var(--baseBg);
        background-image: linear-gradient(var(--baseFg), var(--baseFg)),
          linear-gradient(-135deg, transparent 50%, var(--accentBg) 50%),
          linear-gradient(-225deg, transparent 50%, var(--accentBg) 50%),
          linear-gradient(var(--accentBg) 42%, var(--accentFg) 42%);
        background-repeat: no-repeat, no-repeat, no-repeat, no-repeat;
        background-size: 1px 100%, 20px 22px, 20px 22px, 20px 100%;
        background-position: right 20px center, right bottom, right bottom, right bottom;
      }
    
    select:hover {
    background-image: linear-gradient(var(--accentFg), var(--accentFg)),
        linear-gradient(-135deg, transparent 50%, var(--accentFg) 50%),
        linear-gradient(-225deg, transparent 50%, var(--accentFg) 50%),
        linear-gradient(var(--accentFg) 42%, var(--accentBg) 42%);
    }
    
    select:active {
    background-image: linear-gradient(var(--accentFg), var(--accentFg)),
        linear-gradient(-135deg, transparent 50%, var(--accentFg) 50%),
        linear-gradient(-225deg, transparent 50%, var(--accentFg) 50%),
        linear-gradient(var(--accentFg) 42%, var(--accentBg) 42%);
    color: var(--accentBg);
    border-color: var(--accentFg);
    background-color: var(--accentFg);
    }
    
    .dropdownTabblad {
        --radius: 5px;
        --baseFg: dimgray;
        --baseBg: white;
        --accentFg: #006fc2;
        --accentBg: #bae1ff;
        width: 400px;
    }
    
    .dropdownTabblad-content a {
        color: black;
        padding: 12px 16px;
        text-decoration: none;
        display: block;
      }
    
    .dropdownTabblad-content a:hover {background-color: #ddd;}
    
    .dropdownTabblad:hover .dropdown-content {display: block;}
    
    .dropdownTabblad:hover .dropbtn {background-color: #3e8e41;}

    .pulse {
      animation-name: color;
      animation-duration: 2s;
      animation-iteration-count: infinite;
  }

  @keyframes color {
      0% {
        background-color: #fafafa;
      }
      50% {
        background-color: #ff8c8c;
      }
      100 {
        background-color: #fafafa;
      }
    }

    ` 

    render(){
        return html`
        <select id="dropdown" name="dropdown" class="dropdownTabblad" @click="${this.twoFunctions}">
          <option>Alle tabladen</option>
        </select>`;
    }


    twoFunctions() {
        this.deletePulse();
        let tableElement = null
        if (document.querySelector('student-page') === null) {
          tableElement = document.querySelector('cursuscoordinator-page').shadowRoot.querySelector('course-info-cursus').shadowRoot.querySelector('course-table');
        } else {
          tableElement = document.querySelector('student-page').shadowRoot.querySelector('course-info-student').shadowRoot.querySelector('course-table');
        }
        tableElement.deleteAscDescFromTableHeaders();
    }

    fillComboBox(shadowPage, listRowObjects2, listSheetNames, KeyListOfConversions, generateLocalStorageBool){
      if (this.shadowRoot.getElementById('dropdown').length === 1){
        listRowObjects2.forEach((name, index) =>{
          let element = document.createElement("option");
          element.textContent = name[0]['Versie update'];
          element.value = listSheetNames[index];
          this.shadowRoot.getElementById('dropdown').appendChild(element);
        })        
        
        /* if statement so the page will get the right table info element*/
        let shadowTableInfo = null
        if (shadowPage.querySelector('course-info-student') === null) {
          shadowTableInfo = shadowPage.querySelector('course-info-cursus').shadowRoot;
        } else {
          shadowTableInfo = shadowPage.querySelector('course-info-student').shadowRoot;
        }
        
        let tableElement = shadowTableInfo.querySelector('course-table');
        tableElement.addSortFunction();

        this.shadowRoot.getElementById('dropdown').addEventListener('change', () => {
            tableElement.generateTableSheet(this.shadowRoot.getElementById('dropdown').value, listRowObjects2, KeyListOfConversions);
        });
        if (generateLocalStorageBool){
          tableElement.generateStorage(listRowObjects2, KeyListOfConversions);
        }
      }
    }
      
    deletePulse() {
      let shadowPage = null
      if (document.querySelector('student-page') === null) {
          shadowPage = document.querySelector('cursuscoordinator-page').shadowRoot;
      } else {
          shadowPage = document.querySelector('student-page').shadowRoot;
      }
      let shadowdom = shadowPage.querySelector('table-nav').shadowRoot.querySelector('dropdown-tabblad').shadowRoot.querySelector('select');
      shadowdom.classList.remove("pulse")
    }
}

customElements.define('dropdown-tabblad', DropdownTab);