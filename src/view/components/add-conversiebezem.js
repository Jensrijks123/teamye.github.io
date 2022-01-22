import { LitElement, html, css } from "lit";
import { CourseService } from "../../service/CourseService";
import { ConversionService } from "../../service/ConversionService";
import { Conversion } from "../../model/Conversion";
import { Exam } from "../../model/Exam";
import { Course } from "../../model/Course";
import { ExamService } from "../../service/ExamService";

export class addConversieBezem extends LitElement {
 
    static styles = css`
        .container {
            border-radius: 5px;
            padding: 20px;
        }
        .row:after {
            content: "";
            display: table;
            clear: both;
        }
        .col-25 {
            font-size: 25px;
            float: left;
            width: 25%;
            margin-top: 6px;
        }
        
        .col-75 {
            font-size: 25px;
            float: left;
            width: 40%;
            margin-top: 6px;
        }
        .col-75 input {
            width: 100%;
            padding: 8px;
            border: 1px solid #CCC;
            border-radius: 2px;
            resize: vertical;
            text-align:left;
            font-size: 20px;
        }
        #submitbutton {
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
        .back {
            margin-top: 10px;
            margin-left: 20px;
            padding: 0.8rem 1.5rem;
            font-weight: bold;
            font-size: 0.9rem;
            color: 0, 0, 0;
            border: none;
            border-radius: 15px;
            outline: none;
            cursor: pointer;
            background: rgb(171 171 171);
        }

        .inputselect {
            marging-left: 5px;
            padding: 0.8rem 1.5rem;
            font-weight: bold;
            font-size: 0.9rem;
            color: 0, 0, 0;
            border: none;
            border-radius: 15px;
            outline: none;
            cursor: pointer;
        }

        
        .back:hover {
            background: rgb(145 145 145);
        }
        
        .back:active {
            transform: scale(.98);
        }
    `;

    constructor() {
        super();
        this.conversionService = new ConversionService();
        this.courseService = new CourseService();
        this.examService = new ExamService();
    }

    render() {
        return html`
        <button class="back" @click="${this.BackToHomePage}">
            Terug
        </button>
        <form id="createConversieBezem">
            <div class="container">
            <form id="addConversie">
                <h1>Nieuwe conversie/bezem</h1>

                <fieldset>
                <legend>Oude Toets</legend>
                <div class="row">
                    <div class="col-25">
                        <label for="cursuscode">Cursuscode:</label>
                    </div>
                    <div class="col-75">
                        <input type="text" id="cursuscode" name="cursuscode" required>
                    </div>
                </div>
                <br>
                
                <div class="row">
                    <div class="col-25">
                        <label for="oudeexamentype">Oude examentype:</label>
                    </div>
                    <div class="col-75">
                        <input type="text" id="oudeexamentype" name="oudeexamentype" required>
                    </div>
                </div>
                <br>
                </fieldset>

                <fieldset>
                    <legend>Nieuwe Toets</legend>
                    <div class="row">
                        <div class="col-25">
                            <label for="examentype">Examen type:</label>
                        </div>
                        <div class="col-75">
                            <input type="text" id="examentype" name="examentype" required />
                        </div>
                    </div>
                    <br>
            
                    <div class="row">
                        <div class="col-25">
                            <label for="ecexamen">EC Examen:</label>
                        </div>
                        <div class="col-75">
                            <input type="number" id="ecexamen" name="EC" required />
                        </div>
                    </div>
                    <br>
            
                    <div class="row">
                        <div class="col-25">
                            <label for="wegingexamen">Weging:</label>
                        </div>
                        <div class="col-75">
                            <input type="number" id="wegingexamen" name="Weging" required />
                        </div>
                    </div>
                    <br>
            
                    <div class="row">
                        <div class="col-25">
                            <label for="coordinatorexamen">Coördinator:</label>
                        </div>
                        <div class="col-75">
                            <input type="text" id="coordinatorexamen" name="Coördinator" required />
                        </div>
                    </div>
                    <br>
                </fieldset>

                <br>
                <div class="row">
                    <div class="col-25">
                        <label for="examen">Conversie of Bezem:</label>
                    </div>
                    <div class="col-75">
                        <select class="inputselect" name="conversiebezem" id="conversiebezem" required>
                            <option value="Conversie">Conversie</option>
                            <option value="Bezem">Bezem</option>
                        </select>
                    </div>
                </div>
                <br>
                
                <div class="row">
                    <div class="col-25">
                        <label for="opmerking">Opmerking:</label>
                    </div>
                    <div class="col-75">
                        <input type="text" id="opmerking" name="opmerking" required />
                    </div>
                </div>
                <br>

                <div class="row">
                    <div class="col-25">
                        <label for="nieuwecode">Wat word de nieuwe Cursuscode?</label>
                    </div>
                    <div class="col-75">
                        <input type="text" id="nieuwecode" name="nieuwecode" required />
                    </div>
                </div>
                <br>

                <div class="row">
                    <div class="col-25">
                        <label for="nieuwenaam">Wat word de nieuwe Cursusnaam?</label>
                    </div>
                    <div class="col-75">
                        <input type="text" id="nieuwenaam" name="nieuwenaam" required />
                    </div>
                </div>
                <br>

                <div class="row">
                    <div class="col-25">
                        <label></label>
                    </div>
                    <div class="col-75">
                        <button id="submitbutton" @click="${this.submitConversie}">Maak nieuwe conversie/bezem aan</button>
                    </div>
                </div>
            </div>
            </div>
        </form>
        `;
    }

    submitConversie(event){
        event.preventDefault();
        let cursuscode = this.shadowRoot.getElementById('cursuscode').value;
        let oudeexamentype = this.shadowRoot.getElementById('oudeexamentype').value;
        let conversiebezem = this.shadowRoot.getElementById('conversiebezem').value;
        let examentype = this.shadowRoot.getElementById('examentype').value;
        let ecexamen = this.shadowRoot.getElementById('ecexamen').value;
        let wegingexamen = this.shadowRoot.getElementById('wegingexamen').value;
        let coordinatorexamen = this.shadowRoot.getElementById('coordinatorexamen').value;
        let opmerking = this.shadowRoot.getElementById('opmerking').value;
        let nieuwecode = this.shadowRoot.getElementById('nieuwecode').value;
        let nieuwenaam = this.shadowRoot.getElementById('nieuwenaam').value;
        
        let cursusObjects = [];
        let courses = this.courseService.getCourses();
        for (let course of courses){
            if (course.code === cursuscode){
                cursusObjects.push(course);
            }
        }
        if (cursusObjects.length !== 0){
            let oldCourse;
            let oudeExamen;
            if (cursusObjects.length > 1){
                for (let object of cursusObjects){
                    if (object['exams']['examType'] === oudeexamentype){
                        oldCourse = object;
                        oudeExamen = object['exams'];
                    }
                }
            }else{
                if (cursusObjects[0]['exams']['examType'] === oudeexamentype){
                    oldCourse = object;
                    oudeExamen = cursusObjects[0]['exams'];
                }
            }
            if (oudeExamen != null){
                if (examentype.length > 0){
                    console.log("erdoor?");
                    if (ecexamen.length > 0){
                        if (wegingexamen.length > 0){
                            if (coordinatorexamen.length > 0){
                                if (nieuwecode.length > 0){
                                    if (nieuwenaam.length > 0){
                                        const newExam = new Exam(examentype, ecexamen, wegingexamen, coordinatorexamen);
                                        this.examService.saveExam(newExam);
                                        const newCourse = new Course(cursusObjects[0].education, nieuwecode, nieuwenaam, cursusObjects[0].period, cursusObjects[0].ecCourse, newExam);
                                        this.courseService.saveCourse(newCourse);
                                        const conversion = new Conversion(conversiebezem, oldCourse, newCourse, opmerking, "crud");
                                        console.log(conversion);
                                        this.conversionService.saveConversion(conversion);
                                        this.conversionService.saveConversionToLocalStorage(conversion);
                                        alert("Succesvol conversie aangemaakt!")
                                    }else{alert("Vul een nieuwe cursusnaam in")}
                                }else{alert("Vul een nieuwe cursuscode in")}
                            }else{alert("Vul het veld 'Coördinator' in!")}
                        }else{alert("Vul het veld 'Weging' in!")}
                    }else{alert("Vul het veld 'EC Examen' in!")}
                }else{alert("Vul het veld 'Examen type' in!")}
            }else{alert("Er bestaat geen examen die bij de bovenstaande cursuscode hoort!")}
        }else{alert("Vul een geldige cursuscode in!")}
    }


    BackToHomePage(){
        window.location.href = "http://localhost:8000/"
    }

    
}

customElements.define('add-conversie-bezem', addConversieBezem);