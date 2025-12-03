console.log("test");

import van from 'vanjs-core';

const {div, input, label, button} = van.tags;

function App(){

    function btn_test(){
        console.log("test");
    }

    return div(
        label("test"),
        button({onclick:btn_test},"test")
    )
}


van.add(document.body, App());