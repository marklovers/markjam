import { Component } from "preact";

export default class Nav extends Component {
    state = {
        activeTab: 0,
    };

    render() {
        return (
            <nav class="h-fit p-5 grid grid-cols-1 grid-rows-2 items-center font-unscii bg-[#fcef8d] md:grid-cols-2 md:grid-rows-1">
                <img class="inline-block h-10 mx-auto md:mx-0" src="images/Logo.png"></img>

                <ul class="flex flex-row justify-center inline-block md:justify-around">
                    <li class="text-lg text-bold mx-2">
                        <a href="/">Home</a>
                    </li>
                    <li class="text-lg text-bold mx-2">
                        <a href="/jams">Jams</a>
                    </li>
                    <li class="text-lg text-bold mx-2">
                        <a href="/winners">Winners</a>
                    </li>
                </ul>
            </nav>
        );
    }
}
