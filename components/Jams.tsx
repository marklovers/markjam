interface JamProps {
    data: any;
}

export default function Jams(props: JamProps) {
    return (
        <div class="flex justify-center mx-auto my-4">
            <div class="inline-flex flex-row gap-2 align-items-center overflow-y-hidden overflow-x-auto flex-nowrap">
                {props.data}
            </div>
        </div>
    );
}
