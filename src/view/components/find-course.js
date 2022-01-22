import { LitElement, html, css } from 'lit';
import { ConversionService } from '../../service/ConversionService';
import {Coursetable} from './course-table';
import {FilterCourses} from './filter-courses';

export class FindCourse extends LitElement {
    static styles = css`
#search {
    grid-area: search;
    height: fit-content;
    width:100%;
    display: flex;
    align-items: flex-start;
    justify-content:right;
}
#search-id {
    width: 300px;
    border-color: gainsboro;
}
.flex-container-search{
    display: flex;
    flex-direction:row;
    border:1px solid grey;
    padding:2px;
    border-radius: 5px;
    width: fit-content;
}
.inputfield{
    flex-grow:2;
    border:none;
}

.inputfield:focus {
    outline: none;
  }
.search-button {
    border: none;
    background: white;
    opacity: 0.8;
}
.search-button:active {
    transform: scale(.92);
}
.search-button:active,
.search-button:hover,
.search-button:focus {
    cursor: pointer;
    opacity: 1;
    outline: 1;
}

    `;

    constructor() {
        super();
        this.conversionService = new ConversionService();
        this.list = "";
        this.courseTable = new Coursetable();
        this.filterTable = new FilterCourses();

    }

    render() {
        return html`
            <div class="flex-container-search">
                <input  tabindex="0"
                        name="search"
                        class="inputfield"
                        type="search"
                        id="search-id"
                        placeholder="Zoek naar een code..."
                        aria-label="Zoeken naar code"
                        value="${this.value}"
                        .onkeyup="${(e) => this.keyUpHandler(e)}">
                <button class="search-button" type="submit" @click="${this.clickHandler}" >
                    <img src="src/images/search.png" alt="zoek icon" width="16px" height="17px">
                </button>
            </div>`;

    }

    keyUpHandler(e) {
            this.findCourse(e.target.value);
    }

    clickHandler() {
        this.findCourse(this.shadowRoot.querySelector('input').value);
    }

    findCourse(value) {
        /* if statement so the page will get the right element*/
        let shadowPage = null
        let shadowTableInfo = null
        if (document.querySelector('student-page') == null) {
            shadowPage = document.querySelector('cursuscoordinator-page').shadowRoot;
            shadowTableInfo = shadowPage.querySelector('course-info-cursus').shadowRoot;
        } else {
            shadowPage = document.querySelector('student-page').shadowRoot;
            shadowTableInfo = shadowPage.querySelector('course-info-student').shadowRoot;
        }

        //de header goed
        shadowTableInfo.querySelector('course-table').shadowRoot.getElementById("course-table-id").getElementsByTagName('table').item(0).getElementsByTagName('th').item(0).innerHTML = "Oude code";
        shadowTableInfo.querySelector('course-table').shadowRoot.getElementById("course-table-id").getElementsByTagName('table').item(0).getElementsByTagName('th').item(1).innerHTML = "Opleiding";
        shadowTableInfo.querySelector('course-table').shadowRoot.getElementById("course-table-id").getElementsByTagName('table').item(0).getElementsByTagName('th').item(2).innerHTML = "Oude naam";

        /// hier gebruik ik de localstorage omdat de data is niet in de model zijn opgeslagen
        let conversions = this.conversionService.getConversions();
        let arrayList = [];
        console.log(value);

        for (let item of conversions) {
            let conversion =[];
            if (item.oldCourse.code.includes(value) || item.newCourse.code.includes(value)) {
                conversion.push({"oldCode": item.oldCourse.code},
                    {"education":item.oldCourse.education},
                    {"oldName":item.oldCourse.name},
                    {"bezem/Conversion":item.bezemOrConversion},
                    {"newCode":item.newCourse.code},
                    {"newName":item.newCourse.name},
                    {"period":item.newCourse.period},
                    {"EC-Cursus":item.newCourse.ecCourse},
                    {"Toets en toetsvorm":item.newCourse.exams.examType},
                    {"Weging nieuwecourse":item.newCourse.exams.weighting},
                    {"Weging oudecourse":item.oldCourse.exams.weighting},
                    {"EC-nieuwetoets":item.newCourse.exams.ecExam},
                    {"EC-oudetoets":item.oldCourse.exams.ecExam},
                    {"Programmaleider nieuw":item.newCourse.exams.coordinator}
                );
                arrayList.push(conversion)
            }
        }
        this.list = arrayList;
        this.courseTable.showSearchData(arrayList);
    }

}

customElements.define('find-course', FindCourse);





