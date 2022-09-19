export default function Nav() {
    return (
        <nav class="h-fit p-5 grid grid-cols-2 grid-rows-1 items-center">
            <img class="inline-block h-10" src="images/Logo.png"></img>

            <ul class="flex flex-row justify-around inline-block">
                <li>
                    <a>Home</a>
                </li>
                <li>
                    <a>Jams</a>
                </li>
                <li>
                    <a>Winners Showcase</a>
                </li>
            </ul>
        </nav>
    );
}
