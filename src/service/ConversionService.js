import {Conversion} from "../model/Conversion";
import { Course } from "../model/Course";
import {Exam} from "../model/Exam";

export class ConversionService{

    constructor() {
        this.localDB = window.localStorage;
        this.conversie = "";
    }

    saveConversion(conversion) {
        let existingconversion = JSON.parse(this.localDB.getItem('conversions'));
        existingconversion.push(conversion);
        this.conversie = existingconversion;
        this.localDB.setItem('conversions', JSON.stringify(existingconversion));
    }

    saveConversionToLocalStorage(conversion){
        let existingStorage = JSON.parse(this.localDB.getItem('storage'));
        existingStorage[9].push(conversion);
        this.localDB.setItem('storage', JSON.stringify(existingStorage)); //werkt nog niet????
    }

    getConversions(){
        return JSON.parse(this.localDB.getItem('conversions'));
    }




}
