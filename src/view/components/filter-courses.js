import { LitElement, html, css } from 'lit';
import {Coursetable} from './course-table';

export class FilterCourses extends LitElement {
    static styles = css`

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

    `;

    constructor() {
        super();
        this.courseTable = new Coursetable;
    }

    render() {
        return html`
            <div class="dropdownTabblad-content" id="filter" >
                <select id="dropdown" class="dropdownTabblad" @change="${this.changeHandler}">
                    <option>kies een periode</option>
                    <option value="A">A</option>
                    <option value="B"> B</option>
                    <option value="C" >C</option>
                    <option value="D">D</option>
                    <option value="E">E</option>
                    <option value="Jaar">Jaar</option>
                </select>
            </div>
    `;
    }

    changeHandler(e) {
        this.filterCourses(e.target.value);
    }

    filterCourses() {
        let shadowPage=null;
        if (document.querySelector('student-page') === null) {
            shadowPage = document.querySelector('cursuscoordinator-page').shadowRoot;
        } else {
            shadowPage = document.querySelector('student-page').shadowRoot;
        }
        let value = shadowPage.querySelector('table-nav').shadowRoot.querySelector('filter-courses').shadowRoot.querySelector('select').value;
        let elementFindCourse = shadowPage.querySelector('table-nav').shadowRoot.querySelector('find-course');
        let conversions = elementFindCourse.list;
        let filterConversions = [];
        if(value!=="kies een periode"){
        for (let conversion of conversions){
            if (Object.values(conversion[6])[0].includes(value)){
                filterConversions.push(conversion);
            }
        }
        this.courseTable.showSearchData(filterConversions);
        }
    }
}

customElements.define('filter-courses', FilterCourses);
