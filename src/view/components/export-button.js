import { LitElement, html, css } from "lit";
import { Conversion } from '../../model/Conversion';
import { ConversionService} from '../../service/ConversionService'
import { CourseService } from '../../service/CourseService';

    
export class exportButton extends LitElement {

    static styles = css`
    .export-button {
        padding: 0.8rem 1.5rem;
        font-weight: bold;
        font-size: 0.9rem;
        color: 0, 0, 0;
        border: none;
        border-radius: 15px;
        outline: none;
        cursor: pointer;
        background: rgb(171 171 171);
        margin-left: 1rem;

    }
    

    .button-label:hover, .export-button:hover {
        background: rgb(145 145 145);
    }
    
    .button-label:active, .export-button:active {
        transform: scale(.98);
    }
    
    `;

    constructor() {
        super();
        this.ConversionService = new ConversionService();
        this.courseService = new CourseService();
    }
    
    
    render() {
        return html`
        <div tabindex="0" .onkeyup=${(e) => this.keyUpHandler(e)}>
            <button class="export-button" @click="${this._exportSheetToExcel}">
                Exporteren
            </button>
        </div>
        `;
    }

    
    keyUpHandler(e) {
        if (e.key === 'Enter') {
            this.shadowRoot.querySelector('.export-button').click();
        }
    }

    

    _exportSheetToExcel() {  
        const wb = XLSX.utils.book_new();

        this._fillTableWithData(wb, 'sheet1')
        this._fillTableWithData(wb, 'sheet2')
        this._fillTableWithData(wb, 'sheet3')
        this._fillTableWithData(wb, 'sheet4')
        this._fillTableWithData(wb, 'sheet5')
        this._fillTableWithData(wb, 'sheet6')
        this._fillTableWithData(wb, 'sheet7')
        this._fillTableWithData(wb, 'sheet8')
        this._fillTableWithData(wb, 'sheet9')

        this._exportFunction(wb);
    }

    _fillTableWithData(wb, sheet) {
        let conversionList =  this.ConversionService.getConversions();
        let conversions = [];
        for(let item of conversionList) {
            if(item.sheet === sheet) { //sheet variable
                conversions.push({
                    "Opleiding" : item.oldCourse.education,
                    "Oude code" : item.oldCourse.code,  
                    "Oude name" : item.oldCourse.name,
                    "Oude periode" : item.oldCourse.period,
                    "Oude EC-cursus" : item.oldCourse.ecCourse,
                    "Oude Toets en toetsvorm" : item.oldCourse.exams.examType,
                    "Oude Weging %" :  item.oldCourse.exams.weighting,
                    "Oude EC-toets" : item.oldCourse.exams.ecExam,
                    "Code" : item.newCourse.code,  
                    "Naam" : item.newCourse.name,
                    "Periode" : item.newCourse.period,
                    "EC-cursus" : item.newCourse.ecCourse,
                    "Toets en toetsvorm" : item.newCourse.exams.examType,
                    "Weging %" :  item.newCourse.exams.weighting,
                    "EC-cursus" : item.newCourse.exams.ecExam,
                    "coordinator" : item.newCourse.exams.coordinator
                });
            }
        }
        const ws = XLSX.utils.json_to_sheet(conversions);
        XLSX.utils.book_append_sheet(wb, ws, sheet);
    }
        
    _exportFunction(wb) {
        const fileName = 'BezemEnConversieRegeling.xlsx';
        XLSX.writeFile(wb, fileName);
    }
}

customElements.define('export-button', exportButton);