import {createAction} from "@reduxjs/toolkit";

export default {
    loggedIn: createAction('login/loggedIn'),
    loggedOut: createAction('login/loggedOut')
};